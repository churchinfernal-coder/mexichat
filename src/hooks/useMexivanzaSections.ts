/**
 * useMexivanzaSection -- Real-time data hook for any MexiVanza table.
 *
 * CORRECT table names from live MexiVanza DB:
 *   user_posts (487), user_videos (299), travel_packages (176),
 *   meximart_listings (183), businesses (17), profiles (443), groups (1)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { mexivanza } from '@/integrations/mexivanza/client';

// --- Generic record type for all sections ---
export interface MexiRecord {
  id: string;
  title: string;
  subtitle: string;
  image: string | null;
  video_url: string | null;
  extra: string;
  created_at: string;
  raw: Record<string, any>;
}

const PAGE_SIZE = 50;

/** Pick first truthy image from candidate fields; arrays -> first element */
function pickImage(r: any, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (!v) continue;
    if (typeof v === 'string') return v;
    if (Array.isArray(v) && v.length > 0) {
      const first = typeof v[0] === 'string' ? v[0] : v[0]?.url ?? v[0]?.media_url;
      if (first) return first;
    }
  }
  return null;
}

// --- Table config per section ---
interface TableConfig {
  table: string;
  order: string;
  select?: string;
  mapFn: (row: any) => MexiRecord;
}

const TABLE_MAP: Record<string, TableConfig> = {
  amigos: {
    table: 'profiles',
    order: 'created_at',
    mapFn: (r) => ({
      id: r.id,
      title: r.full_name || r.username || 'Usuario',
      subtitle: r.username ? `@${r.username}` : '',
      image: pickImage(r, 'avatar_url'),
      video_url: null,
      extra: r.bio || '',
      created_at: r.created_at ?? '',
      raw: r,
    }),
  },
  grupos: {
    table: 'groups',
    order: 'created_at',
    mapFn: (r) => ({
      id: r.id,
      title: r.name || 'Grupo',
      subtitle: r.member_count != null ? `${r.member_count} miembros` : '',
      image: pickImage(r, 'avatar_url', 'image_url', 'cover_image'),
      video_url: null,
      extra: r.description || '',
      created_at: r.created_at ?? '',
      raw: r,
    }),
  },
  meximart: {
    table: 'meximart_listings',
    order: 'created_at',
    mapFn: (r) => ({
      id: r.id,
      title: r.title || 'Articulo',
      subtitle: r.price != null ? `$${r.price}` : 'Precio sin definir',
      image: pickImage(r, 'images', 'image_url', 'cover_image', 'thumbnail_url'),
      video_url: null,
      extra: [r.category, r.condition !== 'new' ? r.condition : null, r.description].filter(Boolean).join(' - '),
      created_at: r.created_at ?? '',
      raw: r,
    }),
  },
  videos: {
    table: 'user_videos',
    order: 'created_at',
    select: '*,profiles:creator_id(id,full_name,username,avatar_url)',
    mapFn: (r) => ({
      id: r.id,
      title: r.caption || 'Video',
      subtitle: [
        r.views_count != null ? `${r.views_count} vistas` : null,
        r.likes_count != null ? `${r.likes_count} likes` : null,
      ].filter(Boolean).join(' - ') || '',
      image: pickImage(r, 'thumbnail_url'),
      video_url: r.video_url ?? null,
      extra: r.caption || '',
      created_at: r.created_at ?? '',
      raw: r,
    }),
  },
  empresarial: {
    table: 'businesses',
    order: 'created_at',
    mapFn: (r) => ({
      id: r.id,
      title: r.name || r.business_name || 'Negocio',
      subtitle: [r.category, r.city, r.state].filter(Boolean).join(' - '),
      image: pickImage(r, 'logo_url', 'hero_image', 'cover_image_url', 'image_url'),
      video_url: null,
      extra: r.tagline || r.description || '',
      created_at: r.created_at ?? '',
      raw: r,
    }),
  },
  viajes: {
    table: 'travel_packages',
    order: 'created_at',
    mapFn: (r) => ({
      id: r.id,
      title: r.title || r.name || 'Paquete de Viaje',
      subtitle: [
        r.price != null ? `$${r.price} ${r.price_currency || ''}`.trim() : null,
        r.destination,
        r.duration_days ? `${r.duration_days} dias` : r.duration ? `${r.duration} dias` : null,
      ].filter(Boolean).join(' - '),
      image: pickImage(r, 'image_url', 'gallery', 'cover_image', 'thumbnail_url', 'images'),
      video_url: null,
      extra: r.description || '',
      created_at: r.created_at ?? '',
      raw: r,
    }),
  },
  empleo: {
    table: 'empleo_listings',
    order: 'created_at',
    mapFn: (r) => ({
      id: r.id,
      title: r.title || 'Empleo',
      subtitle: [
        r.company ?? r.company_name,
        r.location ?? r.city,
        r.salary ? `$${r.salary}` : null,
      ].filter(Boolean).join(' - '),
      image: pickImage(r, 'image_url', 'logo_url', 'cover_image'),
      video_url: null,
      extra: r.employment_type ?? r.type ?? r.description ?? '',
      created_at: r.created_at ?? '',
      raw: r,
    }),
  },
};

export function useMexivanzaSection(sectionId: string) {
  const [items, setItems] = useState<MexiRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const configRef = useRef(TABLE_MAP[sectionId]);

  configRef.current = TABLE_MAP[sectionId];
  const config = configRef.current;

  const fetchItems = useCallback(
    async (offset = 0, append = false) => {
      const c = configRef.current;
      if (!c) return;
      try {
        if (offset === 0) setLoading(true);

        const { data, error: fetchErr } = await mexivanza
          .from(c.table)
          .select(c.select ?? '*')
          .order(c.order, { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (fetchErr) {
          setError(fetchErr.message);
          setLoading(false);
          return;
        }

        const rows = data ?? [];

        if (!rows || rows.length === 0) {
          if (offset === 0) setItems([]);
          setHasMore(false);
          setLoading(false);
          return;
        }

        const mapped = rows.map(c.mapFn);
        if (append) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            const newItems = mapped.filter((item) => !existingIds.has(item.id));
            return [...prev, ...newItems];
          });
        } else {
          setItems(mapped);
        }
        setHasMore(rows.length >= PAGE_SIZE);
        setError(null);
      } catch (err: any) {
        setError(err.message ?? 'Error loading section');
      } finally {
        setLoading(false);
      }
    },
    [sectionId],
  );

  useEffect(() => {
    if (!config) return;
    setItems([]);
    setHasMore(true);
    setError(null);
    fetchItems(0);
  }, [sectionId, fetchItems]);

  // --- Real-time subscription ---
  useEffect(() => {
    if (!config) return;

    const channel = mexivanza
      .channel(`mexivanza-${sectionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: config.table },
        (payload) => {
          try {
            const mapped = config.mapFn(payload.new);
            setItems((prev) => {
              if (prev.some((item) => item.id === mapped.id)) return prev;
              return [mapped, ...prev];
            });
          } catch { /* ignore malformed rows */ }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: config.table },
        (payload) => {
          try {
            setItems((prev) =>
              prev.map((item) => {
                if (item.id !== (payload.new as any).id) return item;
                // Merge: keep existing joined data (e.g. profiles) that realtime omits
                const merged = { ...item.raw, ...payload.new };
                try { return config.mapFn(merged); } catch { return item; }
              }),
            );
          } catch { /* ignore */ }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: config.table },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setItems((prev) => prev.filter((item) => item.id !== deletedId));
          }
        },
      )
      .subscribe();

    return () => {
      mexivanza.removeChannel(channel);
    };
  }, [sectionId, config]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    fetchItems(items.length, true);
  }, [fetchItems, items.length, hasMore, loading]);

  const refresh = useCallback(() => {
    setHasMore(true);
    fetchItems(0);
  }, [fetchItems]);

  return { items, loading, error, hasMore, loadMore, refresh, supported: !!config };
}
