/**
 * Web Vitals reporting.
 *
 * Loaded via dynamic import from main.tsx so the ~2 KB of measurement code and
 * its listeners never sit in the render-blocking critical path — we want LCP to
 * reflect the app, not the observer. In DEV we log to the console; in PROD we
 * beacon the metric to the endpoint named by VITE_WEB_VITALS_URL, if any.
 */

export type VitalMetric = {
  name: string
  value: number
  rating: string
  id: string
  navigationType?: string
};

type WebVitalsModule = {
  onCLS: (cb: (m: VitalMetric) => void) => void;
  onFCP: (cb: (m: VitalMetric) => void) => void;
  onINP: (cb: (m: VitalMetric) => void) => void;
  onLCP: (cb: (m: VitalMetric) => void) => void;
  onTTFB: (cb: (m: VitalMetric) => void) => void;
  onFID?: (cb: (m: VitalMetric) => void) => void;
};

let started = false;

function send(metric: VitalMetric) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`[Web Vitals] ${metric.name}: ${metric.value} (${metric.rating})`);
    return;
  }

  const endpoint = import.meta.env.VITE_WEB_VITALS_URL;
  if (!endpoint) return;

  const body = JSON.stringify({
    ...metric,
    path: window.location.pathname,
    // Vitals are meaningless without the release they came from.
    release: import.meta.env.VITE_COMMIT_SHA ?? 'dev',
  });

  // sendBeacon survives page unload, which is exactly when LCP/CLS fire.
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    return;
  }

  // Older browsers: fire-and-forget fetch with keepalive.
  void fetch(endpoint, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {
    /* Metrics must never surface an error to the user. */
  });
}

export function startWebVitals() {
  if (started) return;
  started = true;

  void import('web-vitals').then((mod: WebVitalsModule) => {
    mod.onCLS(send);
    mod.onFCP(send);
    mod.onINP(send);
    mod.onLCP(send);
    mod.onTTFB(send);
  });
}