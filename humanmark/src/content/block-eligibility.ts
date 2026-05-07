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
  // Fallback — standalone paragraphs and blockquotes not inside nav
  "p:not(nav p):not(header p):not(footer p)",
  "blockquote",
].join(", ");

export function getTextBlocks(root: Element | Document = document): Element[] {
  return Array.from(root.querySelectorAll<Element>(TEXT_BLOCK_SELECTORS));
}

export function isEligible(el: Element, settings: Settings): boolean {
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (SKIP_TAGS.has(el.tagName)) return false;

  // Skip elements with no layout box (display:none, visibility:hidden)
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;

  // Skip if already analyzed
  if ((el as HTMLElement).dataset.hmState === "done") return false;

  // Skip purely decorative / icon spans
  if (el.tagName === "SPAN") {
    const childText = (el.textContent ?? "").trim();
    // Must have meaningful text length before we treat a span as a content block
    if (childText.length < settings.minTextLength) return false;
    // Skip spans that are themselves inside an already-targeted parent
    const parent = el.closest(
      ".feed-shared-update-v2__description, .update-components-text, article"
    );
    // Only allow the outermost matching span, not nested ones
    if (parent && parent !== el && parent.querySelector("span.break-words") !== el) {
      return false;
    }
  }

  const text = (el.textContent ?? "").trim();
  if (text.length < settings.minTextLength) return false;
  if (text.length > 20_000) return false;

  // Relaxed sentence check — LinkedIn posts often skip terminal punctuation
  const sentenceCount =
    (text.match(/[.!?]+[\s\n]+[A-Z]/g) ?? []).length +
    (text.match(/\n{2,}/g) ?? []).length + // paragraph breaks count
    1;
  if (sentenceCount < 2) return false;

  return true;
}

export function extractText(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}
