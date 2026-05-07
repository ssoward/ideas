import type { Settings } from "../shared/types";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "INPUT"]);
const TEXT_BLOCK_SELECTORS = "p, [role='article'], article, blockquote, .post-body, .entry-content, li:not(nav li)";

export function getTextBlocks(root: Element | Document = document): Element[] {
  return Array.from(root.querySelectorAll<Element>(TEXT_BLOCK_SELECTORS));
}

export function isEligible(el: Element, settings: Settings): boolean {
  // Skip hidden, aria-hidden, and non-text elements
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (SKIP_TAGS.has(el.tagName)) return false;
  if ((el as HTMLElement).offsetParent === null) return false;

  // Skip if parent is also a text block selector (avoid double-counting nested p/li)
  if (el.parentElement?.closest(TEXT_BLOCK_SELECTORS) && el.tagName === "P") {
    const parentTag = el.parentElement.tagName;
    if (parentTag === "LI" || parentTag === "BLOCKQUOTE") return false;
  }

  const text = (el.textContent ?? "").trim();
  if (text.length < settings.minTextLength) return false;
  if (text.length > 20_000) return false; // split handled at send-time

  // Require at least 2 sentences
  const sentenceCount = (text.match(/[.!?]+\s+[A-Z]/g) ?? []).length + 1;
  if (sentenceCount < 2) return false;

  return true;
}

export function extractText(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}
