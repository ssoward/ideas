import type { Settings } from "../shared/types";
import { getTextBlocks, isEligible } from "./block-eligibility";
import { enqueue } from "./scheduler";
import { DEBOUNCE_MS } from "../shared/constants";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeSettings: Settings | null = null;

export function startObserving(settings: Settings): void {
  activeSettings = settings;
  scanPage();

  const observer = new MutationObserver((mutations) => {
    const hasRelevant = mutations.some(
      (m) => m.type === "childList" && m.addedNodes.length > 0
    );
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
  const all = document.querySelectorAll<HTMLElement>("[data-hm-id]");
  for (const el of all) {
    el.dataset.hmSettings = JSON.stringify(settings);
  }
}

function scanPage(): void {
  if (!activeSettings) return;
  const blocks = getTextBlocks(document);
  for (const block of blocks) {
    if (isEligible(block as HTMLElement, activeSettings)) {
      const el = block as HTMLElement;
      el.dataset.hmSettings = JSON.stringify(activeSettings);
      enqueue(el);
    }
  }
}

function scanNewNodes(mutations: MutationRecord[], settings: Settings): void {
  const candidates = new Set<Element>();
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      // Check the node itself
      if (isEligible(el as HTMLElement, settings)) candidates.add(el);
      // Check descendants
      for (const child of getTextBlocks(el)) {
        if (isEligible(child as HTMLElement, settings)) candidates.add(child);
      }
    }
  }
  for (const el of candidates) {
    const htmlEl = el as HTMLElement;
    htmlEl.dataset.hmSettings = JSON.stringify(settings);
    enqueue(htmlEl);
  }
}
