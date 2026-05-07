import type { MessageResponse, Settings } from "../shared/types";
import { initRenderer, updateRendererSettings } from "./renderer";
import { startObserving, updateActiveSettings } from "./mutation-observer";
import { TwitterAdapter } from "./platform-adapters/twitter";
import { LinkedInAdapter } from "./platform-adapters/linkedin";
import { StravaAdapter } from "./platform-adapters/strava";

// Platform adapters indexed by hostname fragment
const ADAPTERS = [TwitterAdapter, LinkedInAdapter, StravaAdapter];

export function getPlatformPostProcess(hostname: string): ((score: number, text: string) => number) | null {
  const adapter = ADAPTERS.find((a) => hostname.includes(a.hostname));
  return adapter ? adapter.postProcessScore.bind(adapter) : null;
}

async function init(): Promise<void> {
  const resp = await sendMessage({ type: "GET_SETTINGS" }) as MessageResponse;
  if (resp.type !== "SETTINGS") return;

  const settings: Settings = resp.payload;

  const hostname = location.hostname;
  const override = settings.siteOverrides[hostname];
  if (override === false || (!settings.enabled && override !== true)) return;

  // Expose the active platform post-processor globally for the scheduler to use
  const postProcess = getPlatformPostProcess(hostname);
  if (postProcess) {
    (window as unknown as Record<string, unknown>).__hmPostProcess = postProcess;
  }

  initRenderer(settings);
  startObserving(settings);

  chrome.storage.onChanged.addListener((changes) => {
    if (changes["settings"]) {
      const newSettings = changes["settings"].newValue as Settings;
      updateRendererSettings(newSettings);
      updateActiveSettings(newSettings);
    }
  });
}

function sendMessage(msg: object): Promise<MessageResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp: MessageResponse) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
      resolve(resp);
    });
  });
}

init().catch(console.error);
