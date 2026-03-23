/**
 * useComunidad — Real-time hook for MexiVanza social feed.
 *
 * Queries the CORRECT table: user_posts (487+ rows).
 * Columns: user_id, caption, media_urls (full URL array), likes_count,
 *          comments_count, shares_count, visibility, type, etc.
 * Author info enriched from profiles table.
 */

import { useState, useEffect, useCallback } from 'react';
import { mexivanza } from '@/integrations/mexivanza/client';

const PAGE_SIZE = 50;

export interface ComunidadPost {
  id: string;
  user_id: string;
  content: string | null;
  content_type: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  hashtags: string[];
  media_urls: { url: string; type: string }[];
  thumbnail_url: string | null;
  created_at: string;
  author_username: string | null;
  author_avatar: string | null;
  author_full_name: string | null;
  raw: Record<string, any>;
}

function mapMedia(raw: any): { url: string; type: string }[] {
  const urls = raw?.media_urls;
  if (!Array.isArray(urls) || urls.length === 0) return [];
  return urls
    .map((item: any) => {
      if (typeof item === 'string') {
        const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(item);
        return { url: item, type: isVideo ? 'video' : 'image' };
      }
      const u = item.url ?? item.media_url ?? item.file_url;
      if (!u) return null;
      return { url: u, type: item.type ?? item.media_type ?? 'image' };
    })
    .filter(Boolean) as { url: string; type: string }[];
}

function mapPost(p: any, profile?: any): ComunidadPost {
  return {
    id: p.id,
    user_id: p.user_id ?? p.creator_id ?? '',
    content: p.caption ?? p.content ?? null,
    content_type: p.type ?? p.content_type ?? 'text',
    like_count: p.likes_count ?? p.like_count ?? 0,
    comment_count: p.comments_count ?? p.comment_count ?? 0,
    share_count: p.shares_count ?? p.share_count ?? p.shares ?? 0,
    view_count: p.view_count ?? p.views_count ?? 0,
    hashtags: p.hashtags ?? [],
    media_urls: mapMedia(p),
    thumbnail_url: p.thumbnail_url ?? null,
    created_at: p.created_at ?? '',
    author_username: profile?.username ?? null,
    author_avatar: profile?.avatar_url ?? null,
    author_full_name: profile?.full_name ?? null,
    raw: p,
  };
}

async function fetchPage(offset: number): Promise<{ posts: any[]; profiles: Map<string, any> }> {
  const { data: rawPosts, error } = await mexivanza
    .from('user_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw new Error(error.message);
  const posts = rawPosts ?? [];

  const userIds = [...new Set(posts.map((p: any) => p.user_id).filter(Boolean))];
  let profileMap = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: profs } = await mexivanza.from('profiles').select('*').in('id', userIds);
    profileMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
  }
  return { posts, profiles: profileMap };
}

export function useComunidad() {
  const [posts, setPosts] = useState<ComunidadPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = useCallback(async (offset = 0, append = false) => {
    try {
      if (offset === 0) setLoading(true);

      const { posts: rawPosts, profiles } = await fetchPage(offset);

      if (rawPosts.length === 0) {
        if (offset === 0 && !append) setPosts([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      const mapped = rawPosts.map((p: any) => mapPost(p, profiles.get(p.user_id)));

      if (append) {
        setPosts((prev) => [...prev, ...mapped]);
      } else {
        setPosts(mapped);
      }

      setHasMore(rawPosts.length >= PAGE_SIZE);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Error loading community');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(0); }, [fetchPosts]);

  // ─── Real-time ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = mexivanza
      .channel('comunidad-user-posts-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_posts' },
        (payload) => {
          const p = payload.new as any;
          mexivanza
            .from('profiles')
            .select('*')
            .eq('id', p.user_id)
            .maybeSingle()
            .then(({ data: profile }) => {
              setPosts((prev) => [mapPost(p, profile), ...prev]);
            });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_posts' },
        (payload) => {
          const p = payload.new as any;
          mexivanza
            .from('profiles')
            .select('*')
            .eq('id', p.user_id)
            .maybeSingle()
            .then(({ data: profile }) => {
              const updated = mapPost(p, profile);
              setPosts((prev) =>
                prev.map((x) => (x.id === updated.id ? updated : x)),
              );
            });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'user_posts' },
        (payload) => {
          const id = (payload.old as any)?.id;
          if (id) setPosts((prev) => prev.filter((x) => x.id !== id));
        },
      )
      .subscribe();

    return () => { mexivanza.removeChannel(channel); };
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    fetchPosts(posts.length, true);
  }, [fetchPosts, posts.length, hasMore, loading]);

  const refresh = useCallback(() => {
    setHasMore(true);
    fetchPosts(0);
  }, [fetchPosts]);

  return { posts, loading, error, hasMore, loadMore, refresh };
}
