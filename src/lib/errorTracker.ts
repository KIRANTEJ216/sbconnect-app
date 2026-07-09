const MAX_ERRORS = 200;
const STORAGE_KEY = 'sbconnect_errors';

export interface TrackedError {
  id: string;
  message: string;
  source: string;
  timestamp: number;
  url: string;
}

export function trackError(source: string, error: unknown) {
  try {
    const errors = loadErrors();
    const msg = error instanceof Error ? error.message : String(error);
    errors.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message: msg,
      source,
      timestamp: Date.now(),
      url: window.location.href,
    });
    if (errors.length > MAX_ERRORS) errors.splice(0, errors.length - MAX_ERRORS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
  } catch {
    // silently fail — error tracking should never throw
  }
}

export function loadErrors(): TrackedError[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearErrors() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently fail
  }
}

export function getRecentErrors(hours = 24): TrackedError[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return loadErrors().filter((e) => e.timestamp >= cutoff);
}
