const STORAGE_KEY = 'sbconnect_rate_limits';

interface RateLimitEntry {
  key: string;
  timestamps: number[];
}

export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const limits: RateLimitEntry[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = limits.find((l) => l.key === key);
    if (!entry) {
      entry = { key, timestamps: [] };
      limits.push(entry);
    }

    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= maxAttempts) {
      return false;
    }

    entry.timestamps.push(now);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limits));
    return true;
  } catch {
    return true;
  }
}

export function getRateLimitRemaining(key: string, maxAttempts: number, windowMs: number): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const limits: RateLimitEntry[] = raw ? JSON.parse(raw) : [];
    const entry = limits.find((l) => l.key === key);
    if (!entry) return maxAttempts;
    const cutoff = Date.now() - windowMs;
    const recent = entry.timestamps.filter((t) => t > cutoff);
    return Math.max(0, maxAttempts - recent.length);
  } catch {
    return maxAttempts;
  }
}
