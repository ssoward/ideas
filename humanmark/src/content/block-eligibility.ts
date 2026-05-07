import type { Settings } from "../shared/types";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "INPUT", "BUTTON"]);

// Ordered from most-specific (platform) to most-generic (fallback)
const TEXT_BLOCK_SELECTORS = [
  // LinkedIn
  "span.break-words",
  ".feed-shared-update-v2__description",
  ".update-components-text",
  ".feed-shared-text-view",
  // Twitter/X
  '[data-testid="tweetText"]',
  // Strava
  ".activity-description",
  ".comment-text",
  // Generic article / blog content
  "article p",
  ".post-body p",
  ".entry-content p",
  ".article-body p",
  ".story-body p",
  "main p",
  // Fallback — standalone paragraphs and blockquotes not inside nav/header/footer
  "p:not(nav p):not(header p):not(footer p)",
  "blockquote",
].join(", ");

export function getTextBlocks(root: Element | Document = document): Element[] {
  return Array.from(root.querySelectorAll<Element>(TEXT_BLOCK_SELECTORS));
}

export function isEligible(el: Element, settings: Settings): boolean {
  if (SKIP_TAGS.has(el.tagName)) return false;

  // aria-hidden on element OR any ancestor — skip the whole subtree
  if (el.closest('[aria-hidden="true"]')) return false;

  // Skip our own injected DOM
  if ((el as HTMLElement).hasAttribute("data-hm-target-id")) return false;
  if (el.id === "hm-toggle" || el.id === "hm-outlines") return false;

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;

  if ((el as HTMLElement).dataset.hmState === "done") return false;

  // For SPAN elements, prefer the outermost match — if a tracked ancestor
  // (article body, post description) is also being scanned, skip the inner span.
  if (el.tagName === "SPAN") {
    const wrappingPost = el.parentElement?.closest(
      ".feed-shared-update-v2__description, .update-components-text, article"
    );
    if (wrappingPost && wrappingPost !== el) return false;
  }

  const text = (el.textContent ?? "").trim();
  if (text.length < settings.minTextLength) return false;
  if (text.length > 20_000) return false;

  // Relaxed sentence check — LinkedIn posts often skip terminal punctuation
  const sentenceCount =
    (text.match(/[.!?]+[\s\n]+[A-Z]/g) ?? []).length +
    (text.match(/\n{2,}/g) ?? []).length +
    1;
  if (sentenceCount < 2) return false;

  return true;
}

export function extractText(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}
