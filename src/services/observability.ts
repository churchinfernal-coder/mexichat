type EventProps = Record<string, string | number | boolean | null | undefined>;

const ANALYTICS_ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim();
const CRASH_REPORT_ENDPOINT = import.meta.env.VITE_CRASH_REPORT_ENDPOINT?.trim();

const sessionId = (() => {
  try {
    return crypto.randomUUID();
  } catch {
    return `mc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
})();

function postJson(url: string, payload: unknown): void {
  if (!url) return;

  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }
  } catch {
    // Fallback to fetch.
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Ignore network errors to avoid impacting UX.
  });
}

export function trackEvent(event: string, props?: EventProps): void {
  if (!ANALYTICS_ENDPOINT) return;

  postJson(ANALYTICS_ENDPOINT, {
    event,
    props: props ?? {},
    sessionId,
    timestamp: new Date().toISOString(),
    app: 'mexichat-web',
    path: typeof window !== 'undefined' ? window.location.pathname : '/',
  });
}

export function trackSecurityEvent(event: string, props?: EventProps): void {
  trackEvent(`security.${event}`, props);
}

export function reportCrash(source: string, error: unknown, extras?: EventProps): void {
  if (!CRASH_REPORT_ENDPOINT) return;

  const err = error instanceof Error ? error : new Error(String(error));

  postJson(CRASH_REPORT_ENDPOINT, {
    source,
    message: err.message,
    stack: err.stack,
    name: err.name,
    extras: extras ?? {},
    sessionId,
    timestamp: new Date().toISOString(),
    app: 'mexichat-web',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    path: typeof window !== 'undefined' ? window.location.pathname : '/',
  });
}

export function initObservability(): void {
  trackEvent('app_open');
}
