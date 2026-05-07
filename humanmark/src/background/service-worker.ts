import type { MessageRequest, MessageResponse, Settings, Stats } from "../shared/types";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../shared/constants";
import { ADAPTERS, heuristicScore, buildResult } from "./api-client";
import { cacheGet, cacheSet, cacheClearExpired } from "./cache";
import { checkRateLimit } from "./rate-limiter";

// Rehydrate settings — deep-merge nested objects so new fields always have defaults
async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  const saved = (result[STORAGE_KEYS.SETTINGS] as Partial<Settings>) ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    threshold: { ...DEFAULT_SETTINGS.threshold, ...(saved.threshold ?? {}) },
    colors:    { ...DEFAULT_SETTINGS.colors,    ...(saved.colors    ?? {}) },
    siteOverrides: saved.siteOverrides ?? {},
  };
}

async function getStats(): Promise<Stats> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);
  return result[STORAGE_KEYS.STATS] as Stats ?? {
    totalScanned: 0, apiCallCount: 0, cacheHits: 0, flaggedCount: 0, lastReset: Date.now(),
  };
}

async function incrementStat(field: keyof Omit<Stats, "lastReset">, value = 1): Promise<void> {
  const stats = await getStats();
  stats[field] += value;
  await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
}

// On install/update, re-save settings to pick up any new default fields
chrome.runtime.onInstalled.addListener(async () => {
  const fresh = await getSettings();
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: fresh });
});

// Schedule periodic cache cleanup
chrome.alarms.create("cache-cleanup", { periodInMinutes: 360 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "cache-cleanup") await cacheClearExpired();
});

chrome.runtime.onMessage.addListener(
  (msg: MessageRequest, _sender, sendResponse: (r: MessageResponse) => void) => {
    handleMessage(msg).then(sendResponse).catch((err) => {
      sendResponse({ type: "ERROR", reason: String(err) });
    });
    return true; // keep channel open for async response
  }
);

async function handleMessage(msg: MessageRequest): Promise<MessageResponse> {
  if (msg.type === "GET_SETTINGS") {
    return { type: "SETTINGS", payload: await getSettings() };
  }

  if (msg.type === "GET_STATS") {
    return { type: "STATS", payload: await getStats() };
  }

  if (msg.type === "SET_SITE_OVERRIDE") {
    const settings = await getSettings();
    settings.siteOverrides[msg.hostname] = msg.enabled;
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    return { type: "SETTINGS", payload: settings };
  }

  if (msg.type === "ANALYZE_BLOCK") {
    const { hash, text } = msg.payload;
    const settings = await getSettings();

    // Check cache first
    const cached = await cacheGet(hash);
    if (cached) {
      await incrementStat("cacheHits");
      if (cached.score >= settings.threshold.uncertain) await incrementStat("flaggedCount");
      return { type: "BLOCK_RESULT", result: { ...cached, source: "cache" } };
    }

    await incrementStat("totalScanned");

    // Use API if configured and privacy acknowledged
    if (
      settings.apiProvider !== "none" &&
      settings.apiKey &&
      settings.privacyAcknowledged
    ) {
      const adapter = ADAPTERS[settings.apiProvider];
      if (adapter) {
        const allowed = await checkRateLimit(adapter.name, adapter.requestsPerMin);
        if (allowed) {
          const truncated = text.slice(0, adapter.maxChars);
          const score = await adapter.analyze(truncated, settings.apiKey);
          const result = buildResult(hash, score, "api", adapter.name);
          await cacheSet(hash, result);
          await incrementStat("apiCallCount");
          if (score >= settings.threshold.uncertain) await incrementStat("flaggedCount");
          return { type: "BLOCK_RESULT", result };
        }
      }
    }

    // Fallback: heuristic scoring (offline, no API key needed)
    const score = heuristicScore(text);
    const result = buildResult(hash, score, "heuristic");
    await cacheSet(hash, result);
    if (score >= settings.threshold.uncertain) await incrementStat("flaggedCount");
    return { type: "BLOCK_RESULT", result };
  }

  return { type: "ERROR", reason: "Unknown message type" };
}
