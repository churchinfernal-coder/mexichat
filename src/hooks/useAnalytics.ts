import { useCallback } from 'react';

export function useAnalytics() {
  const trackEvent = useCallback((event: string, properties?: Record<string, unknown>) => {
    if (import.meta.env.DEV) {
      console.debug('[Analytics]', event, properties);
    }
  }, []);

  return { trackEvent };
}
