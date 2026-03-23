import { useState, useCallback, useRef } from 'react';

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const cache = new Map<string, LinkPreviewData>();

export function useLinkPreview() {
  const [previews, setPreviews] = useState<Map<string, LinkPreviewData>>(new Map());
  const pendingRef = useRef(new Set<string>());

  const extractUrl = useCallback((text: string): string | null => {
    const match = text.match(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/);
    return match?.[1] ?? null;
  }, []);

  const fetchPreview = useCallback(async (url: string): Promise<LinkPreviewData | null> => {
    if (cache.has(url)) return cache.get(url)!;
    if (pendingRef.current.has(url)) return null;
    pendingRef.current.add(url);

    try {
      // Use a CORS proxy or your own Edge Function for OG tag fetching
      // For now, we extract domain info as a lightweight fallback
      const domain = new URL(url).hostname.replace('www.', '');
      const preview: LinkPreviewData = {
        url,
        title: domain,
        description: url,
        image: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
        siteName: domain,
      };

      // Try fetching via edge function if available
      try {
        const resp = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          const data = await resp.json();
          if (data.title) preview.title = data.title;
          if (data.description) preview.description = data.description;
          if (data.image) preview.image = data.image;
          if (data.siteName) preview.siteName = data.siteName;
        }
      } catch {
        // Fallback to domain-only preview is fine
      }

      cache.set(url, preview);
      setPreviews(prev => new Map(prev).set(url, preview));
      return preview;
    } finally {
      pendingRef.current.delete(url);
    }
  }, []);

  return { previews, extractUrl, fetchPreview };
}