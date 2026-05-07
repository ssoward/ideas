export interface Settings {
  enabled: boolean;
  apiProvider: "gptzero" | "sapling" | "none";
  apiKey: string;
  privacyAcknowledged: boolean;
  threshold: {
    ai: number;       // score >= this → red flag (default 0.75)
    uncertain: number; // score >= this → amber (default 0.50)
  };
  minTextLength: number;
  siteOverrides: Record<string, boolean>;
  showOnlyFlagged: boolean;
}

export interface BlockResult {
  hash: string;
  score: number;
  source: "api" | "cache" | "heuristic";
  provider?: string;
  analyzedAt: number;
}

export interface BlockMeta {
  hash: string;
  text: string;
  nodeId: string;
  platform?: string;
}

export type MessageRequest =
  | { type: "ANALYZE_BLOCK"; payload: BlockMeta }
  | { type: "GET_SETTINGS" }
  | { type: "SET_SITE_OVERRIDE"; hostname: string; enabled: boolean }
  | { type: "GET_STATS" };

export type MessageResponse =
  | { type: "BLOCK_RESULT"; result: BlockResult }
  | { type: "SETTINGS"; payload: Settings }
  | { type: "STATS"; payload: Stats }
  | { type: "ERROR"; reason: string };

export interface Stats {
  totalScanned: number;
  apiCallCount: number;
  cacheHits: number;
  flaggedCount: number;
  lastReset: number;
}

export type AnalysisState = "pending" | "analyzing" | "done" | "skipped" | "error";

// Re-export narrower type used in renderer calls
export type RendererState = "analyzing" | "done" | "skipped" | "error";
