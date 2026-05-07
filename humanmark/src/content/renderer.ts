import type { BlockResult, Settings, RendererState } from "../shared/types";
import { CSS } from "../shared/constants";

let shadowHost: HTMLElement | null = null;
let togglePill: HTMLElement | null = null;

export function initRenderer(): void {
  injectStyles();
  injectTogglePill();
}

function injectStyles(): void {
  if (document.getElementById("hm-injected-styles")) return;
  const link = document.createElement("link");
  link.id = "hm-injected-styles";
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("styles/overlay.css");
  document.head.appendChild(link);
}

function injectTogglePill(): void {
  if (document.getElementById(CSS.TOGGLE_PILL)) return;
  const pill = document.createElement("div");
  pill.id = CSS.TOGGLE_PILL;
  pill.className = CSS.TOGGLE_PILL;
  pill.title = "HumanMark — click to pause/resume scanning";
  pill.textContent = "HM";
  pill.addEventListener("click", () => {
    const paused = pill.dataset.paused === "true";
    pill.dataset.paused = String(!paused);
    pill.title = paused ? "HumanMark — scanning active" : "HumanMark — paused";
    pill.classList.toggle("hm-paused", !paused);
  });
  document.body.appendChild(pill);
  togglePill = pill;
}

export function isPaused(): boolean {
  return togglePill?.dataset.paused === "true";
}

export function applyState(nodeId: string, state: RendererState): void {
  const el = document.querySelector<HTMLElement>(`[data-hm-id="${nodeId}"]`);
  if (!el) return;
  el.dataset.hmState = state;
}

export function applyResult(nodeId: string, result: BlockResult, settings: Settings): void {
  const el = document.querySelector<HTMLElement>(`[data-hm-id="${nodeId}"]`);
  if (!el) return;

  el.dataset.hmState = "done";
  el.dataset.hmScore = String(result.score.toFixed(2));

  // Remove any prior badge
  el.querySelector(`.${CSS.BADGE}`)?.remove();

  const score = result.score;
  let level: "ai" | "uncertain" | "human" = "human";
  if (score >= settings.threshold.ai) level = "ai";
  else if (score >= settings.threshold.uncertain) level = "uncertain";

  el.classList.remove("hm-ai", "hm-uncertain");
  if (level !== "human") {
    el.classList.add(`hm-${level}`);
    const badge = buildBadge(result, level);
    el.style.position = "relative";
    el.appendChild(badge);
  }
}

function buildBadge(result: BlockResult, level: "ai" | "uncertain"): HTMLElement {
  const badge = document.createElement("span");
  badge.className = `${CSS.BADGE} hm-${level}`;

  const pct = Math.round(result.score * 100);
  const label = level === "ai" ? `AI ~${pct}%` : `Possibly AI ~${pct}%`;
  badge.textContent = label;
  badge.setAttribute("aria-label", `HumanMark: ${label}`);

  const tooltip = document.createElement("div");
  tooltip.className = CSS.TOOLTIP;
  tooltip.innerHTML = `
    <strong>${label}</strong><br>
    Source: ${result.provider ?? result.source}<br>
    <small>${new Date(result.analyzedAt).toLocaleTimeString()}</small>
  `;
  badge.appendChild(tooltip);

  return badge;
}
