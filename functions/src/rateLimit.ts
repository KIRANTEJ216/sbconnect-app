const stores = new Map<string, number[]>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, timestamps] of stores) {
    stores.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetMs: number } {
  cleanExpired();

  const now = Date.now();
  const cutoff = now - windowMs;

  let timestamps = stores.get(key);
  if (!timestamps) {
    timestamps = [];
    stores.set(key, timestamps);
  }

  timestamps = timestamps.filter((t) => t > cutoff);
  stores.set(key, timestamps);

  if (timestamps.length >= maxAttempts) {
    const oldest = timestamps[0];
    const resetMs = oldest + windowMs - now;
    return { allowed: false, remaining: 0, resetMs };
  }

  timestamps.push(now);
  stores.set(key, timestamps);
  return { allowed: true, remaining: maxAttempts - timestamps.length - 1, resetMs: 0 };
}
