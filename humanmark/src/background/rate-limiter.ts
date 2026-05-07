// Token-bucket rate limiter persisted across service worker restarts
const buckets = new Map<string, { tokens: number; lastRefill: number }>();

export async function checkRateLimit(provider: string, maxPerMin: number): Promise<boolean> {
  const now = Date.now();
  let bucket = buckets.get(provider) ?? { tokens: maxPerMin, lastRefill: now };

  // Refill proportionally based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 60_000;
  bucket.tokens = Math.min(maxPerMin, bucket.tokens + elapsed * maxPerMin);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    buckets.set(provider, bucket);
    return false;
  }

  bucket.tokens -= 1;
  buckets.set(provider, bucket);
  return true;
}
