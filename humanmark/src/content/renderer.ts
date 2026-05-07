/**
 * renderer.ts
 *
 * Owns all visual output for HumanMark:
 *   - Injects per-node CSS outline rules (guaranteed to override host CSS)
 *   - Creates position:fixed badge chips appended directly to document.body
 *   - Manages the draggable HM pill with prev/next instance navigation
 *
 * Design rule: zero CSS class dependencies for colors or badge visibility.
 * Every color and position is set as an inline style so the host page
 * (LinkedIn, Twitter, etc.) cannot override or clip it.
 */

import type { BlockResult, Settings, RendererState } from "../shared/types";
import { CSS, DEFAULT_SETTINGS } from "../shared/constants";

// ─── State ───────────────────────────────────────────────────────────────────

let togglePill: HTMLElement | null = null;
let outlineSheet: HTMLStyleElement | null = null;
let flagsHidden = false;
const flaggedNodes: string[] = [];   // ordered list for prev/next navigation
let currentNavIndex = -1;
let rafPending = false;

// ─── Public API ──────────────────────────────────────────────────────────────

export function initRenderer(settings: Settings): void {
  injectOutlineSheet();
  injectTogglePill(settings);
  window.addEventListener("scroll", scheduleReposition, { passive: true });
  window.addEventListener("resize", scheduleReposition, { passive: true });
}

export function updateRendererSettings(settings: Settings): void {
  // Re-color existing outlines with new colors
  document.querySelectorAll<HTMLElement>("[data-hm-level]").forEach((badge) => {
    const level = badge.dataset.hmLevel as "ai" | "uncertain";
    const color = resolveColor(settings, level);
    applyBadgeColor(badge, color, level);
  });
}

export function isPaused(): boolean { return false; }

export function applyState(nodeId: string, state: RendererState): void {
  const el = document.querySelector<HTMLElement>(`[data-hm-id="${nodeId}"]`);
  if (el) el.dataset.hmState = state;
}

export function applyResult(nodeId: string, result: BlockResult, settings: Settings): void {
  const el = document.querySelector<HTMLElement>(`[data-hm-id="${nodeId}"]`);
  if (!el) return;
  el.dataset.hmState = "done";

  const score = result.score;
  let level: "ai" | "uncertain" | "human" = "human";
  if      (score >= (settings.threshold?.ai      ?? 0.75)) level = "ai";
  else if (score >= (settings.threshold?.uncertain ?? 0.50)) level = "uncertain";
  if (level === "human") return;

  const color = resolveColor(settings, level);

  // 1. Outline — injected as a CSS rule keyed to this node's data-hm-id,
  //    so it wins over any host-page rule including LinkedIn's !important rules.
  addOutlineRule(nodeId, color);

  // 2. Badge chip — position:fixed, appended to documentElement so it isn't
  //    captured by any transform/will-change/filter applied to <body> (which
  //    LinkedIn does on feed scaffolds, creating a containing block for
  //    fixed-positioned descendants and visually trapping the badge).
  removeBadge(nodeId);
  const badge = createBadge(nodeId, result, level, color);
  positionBadge(badge, el);
  document.documentElement.appendChild(badge);

  // 3. Navigation index
  if (!flaggedNodes.includes(nodeId)) {
    flaggedNodes.push(nodeId);
    if (currentNavIndex === -1) currentNavIndex = 0;
    updateNavUI();
  }
}

// ─── Outline sheet ───────────────────────────────────────────────────────────

function injectOutlineSheet(): void {
  if (document.getElementById("hm-outlines")) return;
  outlineSheet = document.createElement("style");
  outlineSheet.id = "hm-outlines";
  document.head.appendChild(outlineSheet);
}

function addOutlineRule(nodeId: string, color: string): void {
  if (!outlineSheet) injectOutlineSheet();
  // Remove existing rule for this node if re-analyzing
  const existing = outlineSheet!.textContent ?? "";
  const cleaned = existing.replace(new RegExp(`/\\*hm:${nodeId}\\*/[^/]*/\\*end\\*/`, "g"), "");
  outlineSheet!.textContent = cleaned +
    `/*hm:${nodeId}*/[data-hm-id="${nodeId}"]{outline:3px solid ${color}!important;` +
    `outline-offset:3px!important;}/*end*/`;
}

// ─── Badge chips ─────────────────────────────────────────────────────────────

function createBadge(
  nodeId: string,
  result: BlockResult,
  level: "ai" | "uncertain",
  color: string
): HTMLElement {
  const pct   = Math.round(result.score * 100);
  const emoji = level === "ai" ? "🤖" : "⚠️";
  const label = level === "ai" ? `${emoji} AI ~${pct}%` : `${emoji} ~${pct}%`;
  const textColor = isLight(color) ? "#111" : "#fff";

  const badge = document.createElement("div");
  badge.id = `hm-badge-${nodeId}`;
  badge.dataset.hmTargetId = nodeId;
  badge.dataset.hmLevel    = level;
  badge.style.cssText = [
    "position:fixed",
    `background:${color}`,
    `color:${textColor}`,
    `box-shadow:0 0 10px ${color}99,0 2px 6px rgba(0,0,0,0.35)`,
    "font-size:11px",
    "font-family:system-ui,-apple-system,sans-serif",
    "font-weight:700",
    "padding:3px 10px",
    "border-radius:99px",
    "white-space:nowrap",
    "letter-spacing:0.3px",
    "cursor:pointer",
    "user-select:none",
    "z-index:2147483647",
    "pointer-events:auto",
    "line-height:1.6",
    flagsHidden ? "display:none" : "display:inline-flex",
    "align-items:center",
    "gap:4px",
  ].join(";");

  // Force the critical positioning props with !important so host-page CSS
  // resets (e.g. body > div { display: block !important }) cannot break us.
  badge.style.setProperty("position", "fixed", "important");
  badge.style.setProperty("z-index", "2147483647", "important");
  badge.style.setProperty("display", flagsHidden ? "none" : "inline-flex", "important");
  badge.style.setProperty("visibility", "visible", "important");
  badge.style.setProperty("opacity", "1", "important");
  badge.style.setProperty("pointer-events", "auto", "important");

  badge.textContent = label;
  badge.title = `Source: ${result.provider ?? result.source} · ${new Date(result.analyzedAt).toLocaleTimeString()}`;

  // Click → scroll to instance
  badge.addEventListener("click", () => {
    const idx = flaggedNodes.indexOf(nodeId);
    if (idx !== -1) navigateTo(idx);
  });

  return badge;
}

function applyBadgeColor(badge: HTMLElement, color: string, level: "ai" | "uncertain"): void {
  badge.style.background  = color;
  badge.style.color       = isLight(color) ? "#111" : "#fff";
  badge.style.boxShadow   = `0 0 10px ${color}99,0 2px 6px rgba(0,0,0,0.35)`;
  // Update outline for the target element too
  const nodeId = badge.dataset.hmTargetId!;
  addOutlineRule(nodeId, color);
}

function removeBadge(nodeId: string): void {
  document.getElementById(`hm-badge-${nodeId}`)?.remove();
}

function positionBadge(badge: HTMLElement, target: HTMLElement): void {
  const rect = target.getBoundingClientRect();
  // Float 26px above the top-left corner of the target element
  badge.style.top  = `${Math.max(4, rect.top - 26)}px`;
  badge.style.left = `${rect.left}px`;
}

function scheduleReposition(): void {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (flagsHidden) return;
    document.querySelectorAll<HTMLElement>("[data-hm-target-id]").forEach((badge) => {
      const target = document.querySelector<HTMLElement>(
        `[data-hm-id="${badge.dataset.hmTargetId}"]`
      );
      if (target) positionBadge(badge, target);
      else badge.remove();
    });
    pruneFlaggedNodes();
    updateNavUI();
  });
}

// ─── Toggle pill with prev/next navigation ───────────────────────────────────

function injectTogglePill(settings: Settings): void {
  if (document.getElementById(CSS.TOGGLE_PILL)) return;

  const pill = document.createElement("div");
  pill.id = CSS.TOGGLE_PILL;
  const ai = resolveColor(settings, "ai");
  pill.style.cssText = [
    "position:fixed", "bottom:20px", "right:20px",
    "background:#0d0d1a", `color:${ai}`,
    "font-size:11px", "font-family:system-ui,sans-serif", "font-weight:800",
    "padding:7px 12px", "border-radius:99px", "cursor:grab", "user-select:none",
    "z-index:2147483647",
    `box-shadow:0 0 12px ${ai}77,0 2px 8px rgba(0,0,0,0.5)`,
    `border:1px solid ${ai}55`,
    "display:flex", "align-items:center", "gap:6px", "pointer-events:auto",
  ].join(";");

  // Restore saved drag position
  const saved = sessionStorage.getItem("hm-pill-pos");
  if (saved) {
    try {
      const { x, y } = JSON.parse(saved) as { x: number; y: number };
      if (Number.isFinite(x) && Number.isFinite(y)) {
        pill.style.left = `${x}px`; pill.style.top = `${y}px`;
        pill.style.right = "auto"; pill.style.bottom = "auto";
      }
    } catch {
      sessionStorage.removeItem("hm-pill-pos");
    }
  }

  // "HM" label
  const label = document.createElement("span");
  label.textContent = "HM";
  label.title = "Click to show/hide flags";

  // Nav controls — hidden until instances found
  const nav = document.createElement("span");
  nav.id = "hm-nav";
  nav.style.cssText = "display:none;align-items:center;gap:3px;";

  const btnPrev = navBtn("◀", "Previous");
  const counter = document.createElement("span");
  counter.id = "hm-counter";
  counter.style.cssText = "font-size:10px;opacity:0.75;min-width:28px;text-align:center;";
  const btnNext = navBtn("▶", "Next");

  btnPrev.addEventListener("click", (e) => { e.stopPropagation(); navigateTo(currentNavIndex - 1); });
  btnNext.addEventListener("click", (e) => { e.stopPropagation(); navigateTo(currentNavIndex + 1); });

  nav.append(btnPrev, counter, btnNext);
  pill.append(label, nav);

  makeDraggable(pill);

  // Toggle show/hide on click (not drag)
  pill.addEventListener("click", () => {
    flagsHidden = !flagsHidden;
    document.querySelectorAll<HTMLElement>("[data-hm-target-id]").forEach((b) => {
      b.style.setProperty("display", flagsHidden ? "none" : "inline-flex", "important");
    });
    if (outlineSheet) outlineSheet.disabled = flagsHidden;
    pill.style.opacity = flagsHidden ? "0.45" : "1";
    pill.title = flagsHidden ? "Flags hidden — click to show" : "";
  });

  pill.style.setProperty("position", "fixed", "important");
  pill.style.setProperty("z-index", "2147483647", "important");
  pill.style.setProperty("display", "flex", "important");
  pill.style.setProperty("visibility", "visible", "important");

  document.documentElement.appendChild(pill);
  togglePill = pill;
}

function navBtn(text: string, title: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.title = title;
  btn.style.cssText = "background:none;border:none;color:inherit;cursor:pointer;font-size:10px;padding:0 2px;pointer-events:auto;line-height:1;";
  return btn;
}

function navigateTo(index: number): void {
  pruneFlaggedNodes();
  if (flaggedNodes.length === 0) {
    currentNavIndex = -1;
    updateNavUI();
    return;
  }
  currentNavIndex = ((index % flaggedNodes.length) + flaggedNodes.length) % flaggedNodes.length;
  const el = document.querySelector<HTMLElement>(`[data-hm-id="${flaggedNodes[currentNavIndex]}"]`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const original = el.style.outlineWidth;
    el.style.outlineWidth = "6px";
    setTimeout(() => { el.style.outlineWidth = original; }, 700);
  }
  updateNavUI();
}

function pruneFlaggedNodes(): void {
  for (let i = flaggedNodes.length - 1; i >= 0; i--) {
    if (!document.querySelector(`[data-hm-id="${flaggedNodes[i]}"]`)) {
      flaggedNodes.splice(i, 1);
      if (i <= currentNavIndex) currentNavIndex = Math.max(-1, currentNavIndex - 1);
    }
  }
}

function updateNavUI(): void {
  const counter = document.getElementById("hm-counter");
  const nav     = document.getElementById("hm-nav");
  if (!counter || !nav) return;
  if (flaggedNodes.length === 0) { nav.style.display = "none"; return; }
  nav.style.display     = "flex";
  counter.textContent   = `${currentNavIndex + 1}/${flaggedNodes.length}`;
}

function makeDraggable(el: HTMLElement): void {
  let sX = 0, sY = 0, sL = 0, sT = 0, dragged = false;
  el.addEventListener("mousedown", (e: MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    e.preventDefault(); dragged = false;
    const r = el.getBoundingClientRect();
    sL = r.left; sT = r.top; sX = e.clientX; sY = e.clientY;
    el.style.cursor = "grabbing";
    el.style.right = "auto"; el.style.bottom = "auto";
    el.style.left = `${sL}px`; el.style.top = `${sT}px`;
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - sX, dy = ev.clientY - sY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
      el.style.left = `${Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  sL + dx))}px`;
      el.style.top  = `${Math.max(0, Math.min(window.innerHeight - el.offsetHeight, sT + dy))}px`;
    };
    const up = () => {
      el.style.cursor = "grab";
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup",   up);
      sessionStorage.setItem("hm-pill-pos", JSON.stringify({
        x: parseFloat(el.style.left), y: parseFloat(el.style.top),
      }));
      if (dragged) el.addEventListener("click", (ev) => ev.stopImmediatePropagation(), { once: true, capture: true });
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup",   up);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveColor(settings: Settings, level: "ai" | "uncertain"): string {
  return level === "ai"
    ? (settings.colors?.ai      ?? DEFAULT_SETTINGS.colors.ai)
    : (settings.colors?.uncertain ?? DEFAULT_SETTINGS.colors.uncertain);
}

function isLight(hex: string): boolean {
  if (hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
