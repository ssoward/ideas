import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  apiProvider: "none",
  apiKey: "",
  privacyAcknowledged: false,
  threshold: { ai: 0.75, uncertain: 0.50 },
  minTextLength: 100,
  siteOverrides: {},
  showOnlyFlagged: false,
};

export const STORAGE_KEYS = {
  SETTINGS: "settings",
  STATS: "stats",
  CACHE_PREFIX: "cache:v1:",
} as const;

export const CSS = {
  BLOCK_PREFIX: "hm-block",
  STATE_PREFIX: "hm-state",
  BADGE: "hm-badge",
  TOOLTIP: "hm-tooltip",
  SHADOW_HOST: "hm-shadow-host",
  TOGGLE_PILL: "hm-toggle",
} as const;

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const BATCH_SIZE = 5;
export const DEBOUNCE_MS = 300;
export const MIN_SENTENCE_COUNT = 2;
