/**
 * useVideoInteractions — Interaction hooks for MexiVanza videos & posts.
 *
 * REAL backend tables:
 *   video_comments (id, video_id, user_id, comment, created_at) + profiles join
 *   user_follows   (follower_id, followed_id, status)
 *   user_videos    (likes_count, comments_count, shares_count, views_count)
 *   user_posts     (likes_count, comments_count, shares_count, view_count)
 *
 * EXISTING RPCs (anonymous-safe):
 *   increment_video_likes, decrement_video_likes,
 *   increment_video_comments, decrement_video_comments,
 *   increment_video_views, increment_video_shares,
 *   track_video_view, increment_post_shares
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { mexivanza } from '@/integrations/mexivanza/client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VideoComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface InteractionState {
  liked: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  comments: VideoComment[];
  commentsLoading: boolean;
  likeLoading: boolean;
}

// ─── Like persistence via localStorage ──────────────────────────────────────

const LIKED_KEY = 'mexivanza_liked';

function getLikedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LIKED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function persistLike(id: string, liked: boolean) {
  const set = getLikedSet();
  if (liked) set.add(id); else set.delete(id);
  try { localStorage.setItem(LIKED_KEY, JSON.stringify([...set])); } catch { /* quota */ }
}

function wasLikedBefore(id: string): boolean {
  return getLikedSet().has(id);
}

// ─── Rate limiter ───────────────────────────────────────────────────────────

const actionTimestamps = new Map<string, number>();

function isRateLimited(key: string, cooldownMs: number): boolean {
  const last = actionTimestamps.get(key);
  if (last && Date.now() - last < cooldownMs) return true;
  actionTimestamps.set(key, Date.now());
  return false;
}

// ─── Native share helper ────────────────────────────────────────────────────

async function nativeShare(title: string, text: string, url: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') return false;
    }
  }
  try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
  return true;
}

// ─── Fetch real comments from video_comments table ──────────────────────────

async function fetchVideoComments(videoId: string): Promise<VideoComment[]> {
  const { data, error } = await mexivanza
    .from('video_comments')
    .select('id,video_id,user_id,comment,created_at,profiles:user_id(full_name,username,avatar_url)')
    .eq('video_id', videoId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    content: row.comment,
    created_at: row.created_at,
    user_id: row.user_id,
    full_name: row.profiles?.full_name ?? null,
    username: row.profiles?.username ?? null,
    avatar_url: row.profiles?.avatar_url ?? null,
  }));
}

// ═════════════════════════════════════════════════════════════════════════════
// useVideoInteraction — single video
// ═════════════════════════════════════════════════════════════════════════════

export function useVideoInteraction(videoId: string, initialCounts?: {
  likes?: number; comments?: number; shares?: number; views?: number;
}) {
  const [state, setState] = useState<InteractionState>(() => ({
    liked: wasLikedBefore(`video-${videoId}`),
    likeCount: initialCounts?.likes ?? 0,
    commentCount: initialCounts?.comments ?? 0,
    shareCount: initialCounts?.shares ?? 0,
    viewCount: initialCounts?.views ?? 0,
    comments: [],
    commentsLoading: false,
    likeLoading: false,
  }));

  const mountedRef = useRef(true);
  const viewRecordedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Sync counts from realtime updates
  useEffect(() => {
    if (!initialCounts) return;
    setState(prev => ({
      ...prev,
      likeCount: initialCounts.likes ?? prev.likeCount,
      commentCount: initialCounts.comments ?? prev.commentCount,
      shareCount: initialCounts.shares ?? prev.shareCount,
      viewCount: initialCounts.views ?? prev.viewCount,
    }));
  }, [initialCounts?.likes, initialCounts?.comments, initialCounts?.shares, initialCounts?.views]);

  // Toggle like — enforced single like via localStorage
  const toggleLike = useCallback(async () => {
    if (isRateLimited(`like-video-${videoId}`, 800)) return;

    const wasLiked = state.liked;

    setState(prev => ({
      ...prev,
      liked: !prev.liked,
      likeCount: prev.liked ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
      likeLoading: true,
    }));
    persistLike(`video-${videoId}`, !wasLiked);

    try {
      const rpcName = wasLiked ? 'decrement_video_likes' : 'increment_video_likes';
      const { error } = await mexivanza.rpc(rpcName, { video_id: videoId });
      if (error) throw error;

      const { data: fresh } = await mexivanza
        .from('user_videos')
        .select('likes_count')
        .eq('id', videoId)
        .maybeSingle();

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          likeLoading: false,
          ...(fresh ? { likeCount: fresh.likes_count } : {}),
        }));
      }
    } catch {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          liked: wasLiked,
          likeCount: wasLiked ? prev.likeCount + 1 : Math.max(0, prev.likeCount - 1),
          likeLoading: false,
        }));
        persistLike(`video-${videoId}`, wasLiked);
      }
    }
  }, [videoId, state.liked]);

  // Add comment — inserts into video_comments table
  const addComment = useCallback(async (content: string) => {
    if (isRateLimited(`comment-video-${videoId}`, 3000)) {
      throw new Error('Espera un momento antes de comentar de nuevo');
    }
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 2000) {
      throw new Error('Comentario inválido');
    }

    const tempComment: VideoComment = {
      id: crypto.randomUUID(),
      content: trimmed,
      created_at: new Date().toISOString(),
      user_id: 'local',
      full_name: 'Tú',
      username: null,
      avatar_url: null,
    };

    setState(prev => ({
      ...prev,
      commentCount: prev.commentCount + 1,
      comments: [tempComment, ...prev.comments],
    }));

    try {
      await mexivanza.from('video_comments').insert({
        video_id: videoId,
        user_id: '00000000-0000-0000-0000-000000000000',
        comment: trimmed,
      });
      await mexivanza.rpc('increment_video_comments', { video_id: videoId });

      // Refresh from DB to get real data
      const comments = await fetchVideoComments(videoId);
      if (mountedRef.current && comments.length > 0) {
        setState(prev => ({ ...prev, comments }));
      }
    } catch { /* keep local comment visible */ }
  }, [videoId]);

  // Record view
  const recordView = useCallback(async () => {
    if (viewRecordedRef.current) return;
    viewRecordedRef.current = true;
    try {
      await mexivanza.rpc('track_video_view', { p_video_id: videoId });
      await mexivanza.rpc('increment_video_views', { video_id: videoId });

      const { data: fresh } = await mexivanza
        .from('user_videos')
        .select('views_count')
        .eq('id', videoId)
        .maybeSingle();

      if (mountedRef.current && fresh) {
        setState(prev => ({ ...prev, viewCount: fresh.views_count }));
      }
    } catch {
      viewRecordedRef.current = false;
    }
  }, [videoId]);

  // Share — native share dialog + RPC
  const recordShare = useCallback(async () => {
    if (isRateLimited(`share-video-${videoId}`, 2000)) return;

    const shareUrl = `https://mexivanza.com/videos/${videoId}`;
    const shared = await nativeShare('MexiVanza Video', '¡Mira este video en MexiVanza!', shareUrl);
    if (!shared) return;

    setState(prev => ({ ...prev, shareCount: prev.shareCount + 1 }));

    try {
      const { error } = await mexivanza.rpc('increment_video_shares', { video_id: videoId });
      if (error) throw error;

      const { data: fresh } = await mexivanza
        .from('user_videos')
        .select('shares_count')
        .eq('id', videoId)
        .maybeSingle();

      if (mountedRef.current && fresh) {
        setState(prev => ({ ...prev, shareCount: fresh.shares_count }));
      }
    } catch {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, shareCount: Math.max(0, prev.shareCount - 1) }));
      }
    }
  }, [videoId]);

  // Load comments — real from video_comments table
  const loadComments = useCallback(async () => {
    setState(prev => ({ ...prev, commentsLoading: true }));
    try {
      const comments = await fetchVideoComments(videoId);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, comments, commentsLoading: false }));
      }
    } catch {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, commentsLoading: false }));
      }
    }
  }, [videoId]);

  return { ...state, toggleLike, addComment, recordView, recordShare, loadComments };
}

// ═════════════════════════════════════════════════════════════════════════════
// usePostInteraction — single post
// ═════════════════════════════════════════════════════════════════════════════

export function usePostInteraction(postId: string, initialCounts?: {
  likes?: number; comments?: number; shares?: number; views?: number;
}) {
  const [state, setState] = useState<InteractionState>(() => ({
    liked: wasLikedBefore(`post-${postId}`),
    likeCount: initialCounts?.likes ?? 0,
    commentCount: initialCounts?.comments ?? 0,
    shareCount: initialCounts?.shares ?? 0,
    viewCount: initialCounts?.views ?? 0,
    comments: [],
    commentsLoading: false,
    likeLoading: false,
  }));

  const mountedRef = useRef(true);
  const viewRecordedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!initialCounts) return;
    setState(prev => ({
      ...prev,
      likeCount: initialCounts.likes ?? prev.likeCount,
      commentCount: initialCounts.comments ?? prev.commentCount,
      shareCount: initialCounts.shares ?? prev.shareCount,
      viewCount: initialCounts.views ?? prev.viewCount,
    }));
  }, [initialCounts?.likes, initialCounts?.comments, initialCounts?.shares, initialCounts?.views]);

  // Toggle like — persisted via localStorage
  const toggleLike = useCallback(async () => {
    if (isRateLimited(`like-post-${postId}`, 800)) return;

    const wasLiked = state.liked;

    setState(prev => ({
      ...prev,
      liked: !prev.liked,
      likeCount: prev.liked ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
      likeLoading: true,
    }));
    persistLike(`post-${postId}`, !wasLiked);

    try {
      const { data: current } = await mexivanza
        .from('user_posts')
        .select('likes_count')
        .eq('id', postId)
        .maybeSingle();

      const currentCount = current?.likes_count ?? 0;
      const newCount = wasLiked ? Math.max(0, currentCount - 1) : currentCount + 1;

      await mexivanza.from('user_posts').update({ likes_count: newCount }).eq('id', postId);

      if (mountedRef.current) {
        setState(prev => ({ ...prev, likeCount: newCount, likeLoading: false }));
      }
    } catch {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, likeLoading: false }));
      }
    }
  }, [postId, state.liked]);

  // Add comment (local-only — no post_comments table on MexiVanza)
  const addComment = useCallback(async (content: string) => {
    if (isRateLimited(`comment-post-${postId}`, 3000)) {
      throw new Error('Espera un momento antes de comentar de nuevo');
    }
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 2000) throw new Error('Comentario inválido');

    const newComment: VideoComment = {
      id: crypto.randomUUID(),
      content: trimmed,
      created_at: new Date().toISOString(),
      user_id: 'local',
      full_name: 'Tú',
      username: null,
      avatar_url: null,
    };

    setState(prev => ({
      ...prev,
      commentCount: prev.commentCount + 1,
      comments: [newComment, ...prev.comments],
    }));

    try {
      const { data: current } = await mexivanza
        .from('user_posts')
        .select('comments_count')
        .eq('id', postId)
        .maybeSingle();

      const newCount = (current?.comments_count ?? 0) + 1;
      await mexivanza.from('user_posts').update({ comments_count: newCount }).eq('id', postId);

      if (mountedRef.current) {
        setState(prev => ({ ...prev, commentCount: newCount }));
      }
    } catch { /* keep local comment visible */ }
  }, [postId]);

  // Record view
  const recordView = useCallback(async () => {
    if (viewRecordedRef.current) return;
    viewRecordedRef.current = true;
    try {
      const { data: current } = await mexivanza
        .from('user_posts')
        .select('view_count')
        .eq('id', postId)
        .maybeSingle();

      const newCount = (current?.view_count ?? 0) + 1;
      await mexivanza.from('user_posts').update({ view_count: newCount }).eq('id', postId);

      if (mountedRef.current) {
        setState(prev => ({ ...prev, viewCount: newCount }));
      }
    } catch {
      viewRecordedRef.current = false;
    }
  }, [postId]);

  // Share — native dialog + RPC
  const recordShare = useCallback(async () => {
    if (isRateLimited(`share-post-${postId}`, 2000)) return;

    const shareUrl = `https://mexivanza.com/posts/${postId}`;
    const shared = await nativeShare('MexiVanza Post', '¡Mira este post en MexiVanza!', shareUrl);
    if (!shared) return;

    setState(prev => ({ ...prev, shareCount: prev.shareCount + 1 }));

    try {
      const { error } = await mexivanza.rpc('increment_post_shares', { post_id: postId });
      if (error) throw error;

      const { data: fresh } = await mexivanza
        .from('user_posts')
        .select('shares_count')
        .eq('id', postId)
        .maybeSingle();

      if (mountedRef.current && fresh) {
        setState(prev => ({ ...prev, shareCount: fresh.shares_count }));
      }
    } catch {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, shareCount: Math.max(0, prev.shareCount - 1) }));
      }
    }
  }, [postId]);

  // Load comments — local state only (no table for post comments)
  const loadComments = useCallback(async () => {
    setState(prev => ({ ...prev, commentsLoading: false }));
  }, []);

  return { ...state, toggleLike, addComment, recordView, recordShare, loadComments };
}

// ═════════════════════════════════════════════════════════════════════════════
// useFollow — follow/unfollow a creator via localStorage + user_follows
// ═════════════════════════════════════════════════════════════════════════════

const FOLLOWS_KEY = 'mexivanza_follows';

export function useFollow(creatorId: string | undefined) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!creatorId) return;
    try {
      const follows: string[] = JSON.parse(localStorage.getItem(FOLLOWS_KEY) ?? '[]');
      setFollowing(follows.includes(creatorId));
    } catch { /* ignore */ }
  }, [creatorId]);

  const toggleFollow = useCallback(async () => {
    if (!creatorId || loading) return;
    if (isRateLimited(`follow-${creatorId}`, 1000)) return;

    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setLoading(true);

    try {
      const follows: string[] = JSON.parse(localStorage.getItem(FOLLOWS_KEY) ?? '[]');
      if (wasFollowing) {
        localStorage.setItem(FOLLOWS_KEY, JSON.stringify(follows.filter(id => id !== creatorId)));
      } else {
        localStorage.setItem(FOLLOWS_KEY, JSON.stringify([...follows, creatorId]));
      }
    } catch { /* quota */ }

    try {
      if (!wasFollowing) {
        await mexivanza.from('user_follows').insert({
          follower_id: '00000000-0000-0000-0000-000000000000',
          followed_id: creatorId,
          status: 'accepted',
        });
      }
    } catch { /* RLS may block — local state is authoritative */ }

    setLoading(false);
  }, [creatorId, following, loading]);

  return { following, toggleFollow, loading };
}
