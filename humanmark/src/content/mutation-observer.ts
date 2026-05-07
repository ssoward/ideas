import type { Settings } from "../shared/types";
import { getTextBlocks, isEligible } from "./block-eligibility";
import { enqueue, setActiveSettings } from "./scheduler";
import { DEBOUNCE_MS } from "../shared/constants";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeSettings: Settings | null = null;

export function startObserving(settings: Settings): void {
  activeSettings = settings;
  setActiveSettings(settings);
  scanPage();

  const observer = new MutationObserver((mutations) => {
    let hasRelevant = false;
    for (const m of mutations) {
      if (m.type !== "childList" || m.addedNodes.length === 0) continue;
      // Ignore mutations whose target is part of HumanMark's own UI to prevent
      // the observer from re-firing on every badge / outline insertion.
      const target = m.target as Element | null;
      if (target?.id === "hm-toggle" || target?.id === "hm-outlines") continue;
      if ((target as HTMLElement | null)?.hasAttribute?.("data-hm-target-id")) continue;
      hasRelevant = true;
      break;
    }
    if (!hasRelevant) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (activeSettings) scanNewNodes(mutations, activeSettings);
    }, DEBOUNCE_MS);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

export function updateActiveSettings(settings: Settings): void {
  activeSettings = settings;
  setActiveSettings(settings);
}

function scanPage(): void {
  if (!activeSettings) return;
  const blocks = getTextBlocks(document);
  for (const block of blocks) {
    if (isEligible(block as HTMLElement, activeSettings)) {
      enqueue(block as HTMLElement);
    }
  }
}

function scanNewNodes(mutations: MutationRecord[], settings: Settings): void {
  const candidates = new Set<Element>();
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      // Ignore our own injected nodes
      if ((el as HTMLElement).hasAttribute?.("data-hm-target-id")) continue;
      if (el.id === "hm-toggle" || el.id === "hm-outlines") continue;

      if (isEligible(el as HTMLElement, settings)) candidates.add(el);
      for (const child of getTextBlocks(el)) {
        if (isEligible(child as HTMLElement, settings)) candidates.add(child);
      }
    }
  }
  for (const el of candidates) enqueue(el as HTMLElement);
}
