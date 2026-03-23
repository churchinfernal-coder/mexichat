/**
 * MEXICHAT -- Comunidad (MexiVanza Portal)
 *
 * ALL data pulled live from MexiVanza Supabase and displayed natively.
 * NO outbound links. Sections: Social, Meximart, Videos, Viajes.
 *
 * Enterprise-grade: error boundaries, rate limiting, payload validation,
 * touch-first mobile UX, lazy loading, infinite scroll, real-time sync.
 *
 * Social: Image carousel, profile modal, interactions
 * Meximart: Product detail with seller info, contact, image gallery
 * Videos: TikTok snap-scroll with interactions
 * Viajes: Travel package detail with gallery, pricing, booking
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Heart, MessageCircle, Share2, Eye, Play, X,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Volume2, VolumeX, Music, Send, UserPlus, UserCheck,
  Users, Calendar, MapPin, ExternalLink, Tag, Clock,
  ShoppingBag, Plane, Star, DollarSign,
} from 'lucide-react';
import { useComunidad, ComunidadPost } from '@/hooks/useComunidad';
import { useMexivanzaSection, MexiRecord } from '@/hooks/useMexivanzaSections';
import { useVideoInteraction, usePostInteraction, useFollow, type VideoComment } from '@/hooks/useVideoInteractions';
import { mexivanza } from '@/integrations/mexivanza/client';
import CreatePostModal from '@/components/community/CreatePostModal';
import CreateListingModal from '@/components/community/CreateListingModal';
import CreateVideoModal from '@/components/community/CreateVideoModal';
import { PenSquare, ShoppingBag as ShoppingBagIcon, Video } from 'lucide-react';

// ===============================================================================
// SVG ICONS
// ===============================================================================

const I = 22;

const SocialIcon = () => (
  <svg width={I} height={I} viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="9" fill="#3B82F6"/>
    <path d="M6 11c0-1.2 1.6-4 5-4s5 2.8 5 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8.5" cy="9" r="1" fill="#fff"/><circle cx="13.5" cy="9" r="1" fill="#fff"/>
  </svg>
);
const MeximartIcon = () => (
  <svg width={I} height={I} viewBox="0 0 22 22" fill="none">
    <rect x="3" y="5" width="16" height="12" rx="2.5" fill="#10B981"/>
    <rect x="6" y="8" width="10" height="6" rx="1" fill="#fff"/><circle cx="11" cy="11" r="1.5" fill="#10B981"/>
  </svg>
);
const VideosIcon = () => (
  <svg width={I} height={I} viewBox="0 0 22 22" fill="none">
    <rect x="2" y="4" width="18" height="14" rx="3" fill="#8B5CF6"/><path d="M9 8v6l5-3z" fill="#fff"/>
  </svg>
);
const ViajesIcon = () => (
  <svg width={I} height={I} viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="9" fill="#EC4899"/>
    <path d="M11 4l1.5 5.5h5.5l-4.2 3 1.5 5.5L11 15l-4.3 3 1.5-5.5-4.2-3h5.5z" fill="#fff"/>
  </svg>
);

// ===============================================================================
// SECTIONS
// ===============================================================================

interface Section { id: string; label: string; icon: React.ReactNode; dataKey: string; }

const SECTIONS: Section[] = [
  { id: 'social',   label: 'Social',   icon: <SocialIcon />,   dataKey: 'social' },
  { id: 'meximart', label: 'meximart', icon: <MeximartIcon />, dataKey: 'meximart' },
  { id: 'videos',   label: 'Videos',   icon: <VideosIcon />,   dataKey: 'videos' },
  { id: 'viajes',   label: 'Viajes',   icon: <ViajesIcon />,   dataKey: 'viajes' },
];

// ===============================================================================
// HELPERS
// ===============================================================================

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function timeAgoLong(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return 'hace unos minutos';
    if (hrs < 24) return `hace alrededor de ${hrs} hora${hrs > 1 ? 's' : ''}`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `hace ${days} dia${days > 1 ? 's' : ''}`;
    return new Date(dateStr).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
}

function fmtN(n: number): string {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtPrice(price: any, currency?: string): string {
  if (price == null) return 'Precio sin definir';
  const num = typeof price === 'number' ? price : parseFloat(String(price));
  if (isNaN(num)) return `$${price}`;
  return `$${num.toLocaleString('es-MX')} ${currency || 'MXN'}`.trim();
}

function memberSince(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
  catch { return ''; }
}

function fmtDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

function extractImages(r: any): string[] {
  const candidates = [r.images, r.media_urls, r.gallery];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      return c.map((img: any) => (typeof img === 'string' ? img : img?.url ?? img?.media_url)).filter(Boolean);
    }
  }
  const single = r.image_url ?? r.cover_image ?? r.thumbnail_url;
  return single ? [single] : [];
}

const conditionLabels: Record<string, string> = {
  new: 'Nuevo', like_new: 'Como nuevo', good: 'Buen estado',
  fair: 'Estado regular', used: 'Usado',
};

// ===============================================================================
// REUSABLE IMAGE CAROUSEL -- swipe + counter + thumbnails (round -> square)
// ===============================================================================

const ImageCarousel: React.FC<{ media: { url: string; type: string }[]; maxH?: string }> = memo(({ media, maxH = '500px' }) => {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const goTo = (i: number) => setIdx(Math.max(0, Math.min(media.length - 1, i)));
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; touchDeltaX.current = 0; };
  const onTouchMove = (e: React.TouchEvent) => { touchDeltaX.current = e.touches[0].clientX - touchStartX.current; };
  const onTouchEnd = () => { if (Math.abs(touchDeltaX.current) > 50) { touchDeltaX.current < 0 ? goTo(idx + 1) : goTo(idx - 1); } touchDeltaX.current = 0; };

  if (media.length === 0) return null;
  const current = media[idx];

  return (
    <div className="relative w-full bg-gray-100" onClick={(e) => e.stopPropagation()}>
      <div className="relative w-full overflow-hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {current.type === 'video' ? (
          <video src={current.url} controls preload="metadata" className={`w-full object-contain bg-black`} style={{ maxHeight: maxH }} />
        ) : (
          <img src={current.url} alt="" className="w-full object-cover" style={{ maxHeight: maxH }} loading="lazy" draggable={false} />
        )}
        {media.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
            {idx + 1} / {media.length}
          </div>
        )}
        {media.length > 1 && idx > 0 && (
          <button onClick={() => goTo(idx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <ChevronLeft size={18} className="text-white" />
          </button>
        )}
        {media.length > 1 && idx < media.length - 1 && (
          <button onClick={() => goTo(idx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <ChevronRight size={18} className="text-white" />
          </button>
        )}
      </div>
      {media.length > 1 && (
        <div className="flex gap-2 px-3 py-2.5 overflow-x-auto scrollbar-hide">
          {media.map((m, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`flex-shrink-0 overflow-hidden border-2 transition-all duration-300 ${
                i === idx ? 'w-14 h-14 rounded-lg border-blue-500 opacity-100 scale-105' : 'w-10 h-10 rounded-full border-transparent opacity-60 hover:opacity-80'
              }`}>
              {m.type === 'video' ? (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center"><Play size={10} className="text-white" fill="white" /></div>
              ) : (
                <img src={m.url} alt="" className="w-full h-full object-cover" loading="lazy" draggable={false} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// Simple image carousel from string array (for meximart/viajes detail)
const SimpleCarousel: React.FC<{ images: string[]; maxH?: string }> = memo(({ images, maxH = '400px' }) => {
  const media = images.map((url) => ({ url, type: 'image' as const }));
  return <ImageCarousel media={media} maxH={maxH} />;
});

// ===============================================================================
// SELLER / CREATOR CARD -- reusable across meximart & viajes
// ===============================================================================

const SellerCard: React.FC<{ userId: string | null; label?: string; onClose?: () => void }> = memo(({ userId, label = 'Vendedor', onClose }) => {
  const navigate = useNavigate();
  const [seller, setSeller] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    mexivanza.from('profiles').select('id,full_name,username,avatar_url').eq('id', userId).maybeSingle()
      .then(({ data }) => { if (data) setSeller(data); });
  }, [userId]);

  if (!seller) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer active:bg-gray-100 transition-colors"
      onClick={() => { onClose?.(); navigate(`/perfil/${seller.id}`); }}>
      <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
        {seller.avatar_url
          ? <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">{(seller.full_name || '?')[0]?.toUpperCase()}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 font-medium">{label}</p>
        <p className="text-sm font-bold text-gray-900 truncate">{seller.full_name || 'Usuario'}</p>
        {seller.username && <p className="text-xs text-gray-500">@{seller.username}</p>}
      </div>
      <ChevronRight size={16} className="text-gray-400" />
    </div>
  );
});

// ===============================================================================
// PROFILE MODAL -- centered popup
// ===============================================================================

interface ProfileData {
  id: string; full_name: string | null; username: string | null; avatar_url: string | null;
  bio: string | null; location: string | null; nationality: string | null; interests: string[];
  followers_count: number; following_count: number; views_count: number; created_at: string;
  posts: { id: string; thumbnail_url: string | null; media_urls: any; type: string; created_at: string }[];
}

const ProfileModal: React.FC<{ userId: string | null; open: boolean; onClose: () => void }> = ({ userId, open, onClose }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [postTab, setPostTab] = useState<'todo' | 'fotos' | 'videos'>('todo');
  const follow = useFollow(userId ?? undefined);

  useEffect(() => {
    if (!open || !userId) { setProfile(null); return; }
    setLoading(true);
    (async () => {
      try {
        const { data: prof } = await mexivanza.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (!prof) { setLoading(false); return; }
        const { data: posts } = await mexivanza.from('user_posts').select('id,thumbnail_url,media_urls,type,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
        const { count: followersCount } = await mexivanza.from('user_follows').select('*', { count: 'exact', head: true }).eq('followed_id', userId).eq('status', 'accepted');
        const { count: followingCount } = await mexivanza.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted');
        const interests: string[] = Array.isArray(prof.interests) ? prof.interests : (typeof prof.interests === 'string' ? prof.interests.split(',').map((s: string) => s.trim()) : []);
        setProfile({ id: prof.id, full_name: prof.full_name, username: prof.username, avatar_url: prof.avatar_url, bio: prof.bio, location: prof.location ?? prof.city ?? null, nationality: prof.nationality ?? null, interests, followers_count: followersCount ?? 0, following_count: followingCount ?? 0, views_count: prof.profile_views ?? prof.views_count ?? 0, created_at: prof.created_at ?? '', posts: posts ?? [] });
      } catch (err) { console.error('ProfileModal fetch error:', err); } finally { setLoading(false); }
    })();
  }, [open, userId]);

  if (!open) return null;

  const filteredPosts = profile?.posts.filter((p) => {
    if (postTab === 'todo') return true;
    if (postTab === 'fotos') return !p.type || p.type !== 'video';
    if (postTab === 'videos') return p.type === 'video';
    return true;
  }) ?? [];

  const getPostThumb = (p: any): string | null => {
    if (p.thumbnail_url) return p.thumbnail_url;
    const urls = p.media_urls;
    if (Array.isArray(urls) && urls.length > 0) { const f = urls[0]; return typeof f === 'string' ? f : f?.url ?? f?.media_url ?? null; }
    return null;
  };

  const photosCount = profile?.posts.filter(p => !p.type || p.type !== 'video').length ?? 0;
  const videosCount = profile?.posts.filter(p => p.type === 'video').length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center z-10 hover:bg-gray-200"><X size={16} className="text-gray-500" /></button>
        {loading && <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>}
        {!loading && profile && (
          <div className="pb-6">
            <div className="flex justify-center pt-6 pb-3">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 bg-gray-200">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl font-bold">{(profile.full_name || '?')[0]?.toUpperCase()}</div>}
              </div>
            </div>
            <div className="flex justify-center gap-2 px-4 pb-3">
              <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"><Users size={14} /> Agregar amigo</button>
              <button onClick={follow.toggleFollow} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold ${follow.following ? 'bg-gray-200 text-gray-700' : 'bg-blue-600 text-white'}`}>
                {follow.following ? <UserCheck size={14} /> : <UserPlus size={14} />} {follow.following ? 'Siguiendo' : 'Seguir'}
              </button>
              <button onClick={() => { onClose(); navigate(`/perfil/${profile.id}`); }} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold">
                <ExternalLink size={14} /> Ver perfil completo
              </button>
            </div>
            <div className="text-center px-4 pb-2">
              <h2 className="text-xl font-bold text-gray-900">{profile.full_name || 'Usuario'}</h2>
              {profile.username && <p className="text-sm text-gray-500">@{profile.username}</p>}
            </div>
            <div className="flex justify-center gap-4 px-4 pb-2 text-sm text-gray-600">
              <span className="flex items-center gap-1"><Users size={14} className="text-gray-400" /><strong>{fmtN(profile.followers_count)}</strong> seguidores</span>
              <span><strong>{fmtN(profile.following_count)}</strong> siguiendo</span>
              <span className="flex items-center gap-1"><Eye size={14} className="text-gray-400" /><strong>{fmtN(profile.views_count)}</strong> vistas</span>
            </div>
            {profile.created_at && <div className="flex justify-center items-center gap-1.5 px-4 pb-2 text-xs text-gray-400"><Calendar size={12} /> Miembro desde {memberSince(profile.created_at)}</div>}
            {profile.location && <div className="flex justify-center items-center gap-1.5 px-4 pb-2 text-xs text-gray-500"><MapPin size={12} /> {profile.location}</div>}
            {profile.nationality && <div className="text-center px-4 pb-2"><span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">Nacionalidades: {profile.nationality}</span></div>}
            {profile.interests.length > 0 && (
              <div className="px-4 pb-3">
                <p className="text-xs font-semibold text-gray-700 mb-1.5">Intereses</p>
                <div className="flex flex-wrap gap-1.5">{profile.interests.map((i) => <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{i}</span>)}</div>
              </div>
            )}
            <div className="border-t border-gray-100 mx-4 mb-3" />
            <div className="flex border-b border-gray-100 mx-4 mb-3">
              {([{ key: 'todo', label: 'Todo', count: profile.posts.length }, { key: 'fotos', label: 'Fotos', count: photosCount }, { key: 'videos', label: 'Videos', count: videosCount }] as const).map((tab) => (
                <button key={tab.key} onClick={() => setPostTab(tab.key)} className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${postTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1 px-4">
              {filteredPosts.map((p) => { const thumb = getPostThumb(p); return (
                <div key={p.id} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin media</div>}
                </div>
              ); })}
              {filteredPosts.length === 0 && <div className="col-span-3 text-center py-8 text-sm text-gray-400">Sin publicaciones</div>}
            </div>
          </div>
        )}
        {!loading && !profile && <div className="text-center py-16 text-sm text-gray-400">No se encontro el perfil</div>}
      </div>
    </div>
  );
};

// ===============================================================================
// COMMENT SHEET
// ===============================================================================

const CommentSheet: React.FC<{
  open: boolean; onClose: () => void; comments: VideoComment[]; loading: boolean;
  onLoad: (offset?: number) => void; onSubmit: (content: string) => Promise<any>;
}> = ({ open, onClose, comments, loading, onLoad, onSubmit }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) onLoad(0); }, [open]);

  const handleSubmit = async () => {
    if (!text.trim() || sending) return;
    setSending(true); setError(null);
    try { await onSubmit(text.trim()); setText(''); onLoad(0); }
    catch (err: any) { setError(err.message || 'Error al enviar'); }
    finally { setSending(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 bg-black/50" />
      <div className="bg-white rounded-t-2xl max-h-[60vh] flex flex-col animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Comentarios</h3>
          <button onClick={onClose} className="p-1"><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-[120px]">
          {loading && comments.length === 0 && <div className="flex justify-center py-8"><div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" /></div>}
          {!loading && comments.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Sin comentarios aun</p>}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-gray-500">{(c.full_name || c.username || '?')[0]}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800">{c.full_name || c.username || 'Usuario'}</p>
                <p className="text-xs text-gray-600 mt-0.5 break-words">{c.content}</p>
                <p className="text-[10px] text-gray-300 mt-0.5">{timeAgo(c.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-red-500 px-4 pb-1">{error}</p>}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Escribe un comentario..." maxLength={2000} className="flex-1 text-sm bg-gray-50 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-blue-200" />
          <button onClick={handleSubmit} disabled={!text.trim() || sending} className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-40">
            <Send size={14} className="text-white ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ===============================================================================
// POST CARD -- Social feed matching MexiVanza
// ===============================================================================

const PostCard: React.FC<{ post: ComunidadPost }> = memo(({ post }) => {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const name = post.author_full_name || post.author_username || 'Usuario';
  const avatar = post.author_avatar;
  const visibility = post.raw?.visibility ?? 'public';

  const interaction = usePostInteraction(post.id, { likes: post.like_count, comments: post.comment_count, shares: post.share_count, views: post.view_count });

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current; if (!el) return;
    const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) interaction.recordView(); }, { threshold: 0.5 });
    obs.observe(el); return () => obs.disconnect();
  }, [interaction.recordView]);

  const media = post.media_urls ?? [];
  const thumbnailFallback = post.thumbnail_url;

  return (
    <>
      <div ref={cardRef} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <button onClick={() => setProfileModalOpen(true)} className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0 active:scale-95 transition-transform">
            {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-blue-600 font-semibold text-sm">{name.charAt(0).toUpperCase()}</span>}
          </button>
          <div className="min-w-0 flex-1">
            <button onClick={() => setProfileModalOpen(true)} className="text-sm font-semibold text-gray-900 truncate block text-left hover:underline active:text-blue-600 transition-colors">{name}</button>
            <p className="text-xs text-gray-400">{timeAgoLong(post.created_at)}</p>
          </div>
          <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{visibility}</span>
        </div>
        {post.content && <p className="px-4 pb-2 text-sm text-gray-800 whitespace-pre-wrap break-words">{post.content}</p>}
        {post.hashtags.length > 0 && <div className="px-4 pb-2 flex flex-wrap gap-1">{post.hashtags.map((t) => <span key={t} className="text-xs text-blue-500 font-medium">#{t}</span>)}</div>}
        {media.length > 0 ? <ImageCarousel media={media} /> : thumbnailFallback ? <div className="w-full bg-gray-100"><img src={thumbnailFallback} alt="" className="w-full object-cover max-h-[500px]" loading="lazy" /></div> : null}
        <div className="px-4 pt-2 pb-1 flex items-center gap-4 text-xs text-gray-500 border-t border-gray-50">
          <span>{interaction.likeCount} me gusta</span><span>{interaction.commentCount} comentarios</span><span>{interaction.shareCount} compartidos</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
          <button onClick={() => interaction.toggleLike()} className="flex items-center gap-1.5 transition-transform active:scale-125">
            <Heart size={18} className={interaction.liked ? 'text-red-500 fill-red-500' : 'text-gray-500'} />
            <span className={`text-sm ${interaction.liked ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>{fmtN(interaction.likeCount)}</span>
          </button>
          <button onClick={() => setCommentsOpen(true)} className="flex items-center gap-1.5 text-gray-500 active:text-blue-500">
            <MessageCircle size={18} /><span className="text-sm">{fmtN(interaction.commentCount)}</span>
          </button>
          <button onClick={() => interaction.recordShare()} className="flex items-center gap-1.5 text-gray-500 active:text-green-500">
            <Share2 size={18} /><span className="text-sm">Compartir</span>
          </button>
        </div>
      </div>
      <ProfileModal userId={post.user_id} open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
      <CommentSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} comments={interaction.comments} loading={interaction.commentsLoading} onLoad={interaction.loadComments} onSubmit={interaction.addComment} />
    </>
  );
});

// ===============================================================================
// MEXIMART DETAIL -- full screen product page matching MexiVanza
// ===============================================================================

const MeximartDetail: React.FC<{ item: MexiRecord; open: boolean; onClose: () => void }> = ({ item, open, onClose }) => {
  const navigate = useNavigate();
  const r = item.raw;
  const images = extractImages(r).length > 0 ? extractImages(r) : (item.image ? [item.image] : []);
  const sellerId: string | null = r.seller_id ?? r.user_id ?? null;
  const condition = r.condition ? (conditionLabels[r.condition] ?? r.condition) : null;
  const category = r.category ?? null;
  const location = [r.city, r.state].filter(Boolean).join(', ') || r.location || null;
  const description = r.description ?? null;
  const price = r.price;
  const currency = r.price_currency ?? r.currency ?? 'MXN';
  const viewsCount = r.views_count ?? r.view_count ?? 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft size={18} className="text-gray-700" /></button>
        <span className="text-sm font-semibold text-gray-700">Volver a MexiMart</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {images.length > 0 && <SimpleCarousel images={images} maxH="400px" />}
        <div className="px-4 py-4 space-y-4">
          <h1 className="text-xl font-bold text-gray-900">{item.title}</h1>
          {condition && <span className="inline-block text-xs font-semibold text-white bg-green-500 px-3 py-1 rounded-full">{condition}</span>}
          {price != null && <p className="text-2xl font-bold text-blue-600">{fmtPrice(price, currency)}</p>}
          <SellerCard userId={sellerId} label="Vendedor" onClose={onClose} />
          {location && <div className="flex items-center gap-2 text-sm text-gray-600"><MapPin size={16} className="text-gray-400" /> {location}</div>}
          {description && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-700 mb-1.5">Descripcion</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{description}</p>
            </div>
          )}
          {category && <div className="flex items-center gap-2"><Tag size={14} className="text-gray-400" /><span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{category}</span></div>}
          <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            <span className="flex items-center gap-1.5"><Eye size={14} /> {viewsCount} vistas</span>
            {item.created_at && <span className="flex items-center gap-1.5"><Calendar size={14} /> {fmtDate(item.created_at)}</span>}
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2 safe-bottom">
        <button onClick={() => { onClose(); navigate('/mensajes', { state: { contactUserId: sellerId } }); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold active:scale-[0.98] transition-all">
          <MessageCircle size={18} /> Contactar
        </button>
        {sellerId && (
          <button onClick={() => { onClose(); navigate(`/perfil/${sellerId}`); }}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all">
            <Users size={16} /> Ver Perfil
          </button>
        )}
      </div>
    </div>
  );
};

// ===============================================================================
// VIAJES DETAIL -- full screen travel package page
// ===============================================================================

const ViajesDetail: React.FC<{ item: MexiRecord; open: boolean; onClose: () => void }> = ({ item, open, onClose }) => {
  const navigate = useNavigate();
  const r = item.raw;
  const images = extractImages(r).length > 0 ? extractImages(r) : (item.image ? [item.image] : []);
  const creatorId: string | null = r.creator_id ?? r.user_id ?? r.agency_id ?? null;
  const destination = r.destination ?? r.country ?? null;
  const duration = r.duration_days ?? r.duration ?? null;
  const price = r.price;
  const currency = r.price_currency ?? r.currency ?? 'MXN';
  const description = r.description ?? null;
  const includes = r.includes ?? r.what_includes ?? null;
  const itinerary = r.itinerary ?? null;
  const viewsCount = r.views_count ?? r.view_count ?? 0;
  const rating = r.rating ?? null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft size={18} className="text-gray-700" /></button>
        <span className="text-sm font-semibold text-gray-700">Volver a Viajes</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {images.length > 0 && <SimpleCarousel images={images} maxH="350px" />}
        <div className="px-4 py-4 space-y-4">
          <h1 className="text-xl font-bold text-gray-900">{item.title}</h1>
          <div className="flex flex-wrap gap-2">
            {destination && <span className="flex items-center gap-1 text-xs bg-pink-50 text-pink-600 px-3 py-1 rounded-full font-medium"><MapPin size={12} /> {destination}</span>}
            {duration && <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium"><Clock size={12} /> {duration} dias</span>}
            {rating && <span className="flex items-center gap-1 text-xs bg-yellow-50 text-yellow-600 px-3 py-1 rounded-full font-medium"><Star size={12} /> {rating}</span>}
          </div>
          {price != null && <p className="text-2xl font-bold text-pink-600">{fmtPrice(price, currency)}</p>}
          <SellerCard userId={creatorId} label="Organizador" onClose={onClose} />
          {description && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-700 mb-1.5">Descripcion</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{description}</p>
            </div>
          )}
          {includes && (
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs font-bold text-green-700 mb-1.5">Incluye</p>
              <p className="text-sm text-green-600 whitespace-pre-wrap break-words">{typeof includes === 'string' ? includes : JSON.stringify(includes)}</p>
            </div>
          )}
          {itinerary && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-700 mb-1.5">Itinerario</p>
              <p className="text-sm text-blue-600 whitespace-pre-wrap break-words">{typeof itinerary === 'string' ? itinerary : JSON.stringify(itinerary)}</p>
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            <span className="flex items-center gap-1.5"><Eye size={14} /> {viewsCount} vistas</span>
            {item.created_at && <span className="flex items-center gap-1.5"><Calendar size={14} /> {fmtDate(item.created_at)}</span>}
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2 safe-bottom">
        <button onClick={() => { onClose(); navigate('/mensajes', { state: { contactUserId: creatorId } }); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-pink-600 text-white rounded-xl text-sm font-bold active:scale-[0.98] transition-all">
          <MessageCircle size={18} /> Consultar
        </button>
        {creatorId && (
          <button onClick={() => { onClose(); navigate(`/perfil/${creatorId}`); }}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all">
            <Users size={16} /> Ver Perfil
          </button>
        )}
      </div>
    </div>
  );
};

// ===============================================================================
// MEXIMART CARD -- tap opens full product detail
// ===============================================================================

const MeximartCard: React.FC<{ item: MexiRecord }> = memo(({ item }) => {
  const [detailOpen, setDetailOpen] = useState(false);
  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:bg-gray-50 transition-colors" onClick={() => setDetailOpen(true)}>
        {item.image && <div className="w-full bg-gray-100"><img src={item.image} alt="" className="w-full object-cover max-h-[400px]" loading="lazy" /></div>}
        <div className="px-4 py-3">
          <p className="text-sm font-bold text-gray-900 line-clamp-2">{item.title}</p>
          {item.subtitle && <p className="text-sm text-blue-600 font-bold mt-0.5">{item.subtitle}</p>}
          <p className="text-[10px] text-gray-300 mt-1">{timeAgo(item.created_at)}</p>
        </div>
      </div>
      <MeximartDetail item={item} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  );
});

// ===============================================================================
// VIAJES CARD -- tap opens full travel package detail
// ===============================================================================

const ViajesCard: React.FC<{ item: MexiRecord }> = memo(({ item }) => {
  const [detailOpen, setDetailOpen] = useState(false);
  const r = item.raw;
  const destination = r.destination ?? r.country ?? null;
  const duration = r.duration_days ?? r.duration ?? null;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:bg-gray-50 transition-colors" onClick={() => setDetailOpen(true)}>
        {item.image && (
          <div className="relative w-full bg-gray-100">
            <img src={item.image} alt="" className="w-full object-cover max-h-[300px]" loading="lazy" />
            {destination && <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm"><MapPin size={10} /> {destination}</div>}
          </div>
        )}
        <div className="px-4 py-3">
          <p className="text-sm font-bold text-gray-900 line-clamp-2">{item.title}</p>
          <div className="flex items-center gap-2 mt-1">
            {item.subtitle && <p className="text-sm text-pink-600 font-bold">{item.subtitle}</p>}
          </div>
          {duration && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Clock size={10} /> {duration} dias</p>}
          <p className="text-[10px] text-gray-300 mt-1">{timeAgo(item.created_at)}</p>
        </div>
      </div>
      <ViajesDetail item={item} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  );
});

// ===============================================================================
// TIKTOK VIDEO CARD
// ===============================================================================

const TikTokCard: React.FC<{
  item: MexiRecord; isActive: boolean; shouldLoad: boolean; muted: boolean; onToggleMute: () => void;
}> = ({ item, isActive, shouldLoad, muted, onToggleMute }) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const r = item.raw;
  const joinedProfile = r.profiles ?? {};

  // Cache creator info so realtime updates without joined data don't blink the avatar
  const creatorRef = useRef({ name: '', avatar: null as string | null, id: undefined as string | undefined });
  const freshName = joinedProfile.full_name || joinedProfile.username || r.creator_username || r.creator_full_name || '';
  const freshAvatar = joinedProfile.avatar_url ?? null;
  const freshId = r.creator_id;
  if (freshName) creatorRef.current.name = freshName;
  if (freshAvatar) creatorRef.current.avatar = freshAvatar;
  if (freshId) creatorRef.current.id = freshId;
  const creatorName = creatorRef.current.name || 'usuario';
  const creatorAvatar: string | null = creatorRef.current.avatar;
  const creatorId: string | undefined = creatorRef.current.id;
  const hashtags: string[] = Array.isArray(r.hashtags) ? r.hashtags : (Array.isArray(r.tags) ? r.tags : []);
  const duration = r.duration_seconds;

  const interaction = useVideoInteraction(item.id, { likes: r.likes_count ?? 0, comments: r.comments_count ?? 0, shares: r.shares_count ?? 0, views: r.views_count ?? 0 });
  const follow = useFollow(creatorId);

  useEffect(() => { if (isActive) interaction.recordView(); }, [isActive]);
  useEffect(() => { const el = videoRef.current; if (!el) return; if (isActive && !paused) { el.currentTime = 0; el.play().catch(() => {}); } else { el.pause(); } }, [isActive, paused, shouldLoad]);
  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted]);
  useEffect(() => { if (isActive) setPaused(false); }, [isActive]);

  const togglePause = useCallback((e: React.MouseEvent) => { if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return; setPaused((p) => !p); }, []);
  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center" onClick={togglePause}>
      {shouldLoad && item.video_url ? (
        <video ref={videoRef} src={item.video_url} poster={item.image || undefined} muted={muted} loop playsInline preload={isActive ? 'auto' : 'metadata'} onLoadedData={() => setLoaded(true)} className="absolute inset-0 w-full h-full object-cover" />
      ) : item.image ? (
        <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : <div className="absolute inset-0 bg-gray-900" />}

      {paused && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"><div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm"><Play size={32} className="text-white ml-1" fill="white" /></div></div>}
      {shouldLoad && !loaded && isActive && <div className="absolute inset-0 flex items-center justify-center z-10"><div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" /></div>}

      <button onClick={(e) => { e.stopPropagation(); onToggleMute(); }} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-20">
        {muted ? <VolumeX size={18} className="text-white" /> : <Volume2 size={18} className="text-white" />}
      </button>

      <div className="absolute right-3 bottom-40 flex flex-col items-center gap-4 z-20">
        <button className="relative flex flex-col items-center" onClick={(e) => { e.stopPropagation(); setProfileModalOpen(true); }}>
          <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-gray-700">
            {creatorAvatar ? <img src={creatorAvatar} alt={creatorName} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-white text-sm font-bold">{creatorName[0]?.toUpperCase()}</span>}
          </div>
          {!follow.following && <button onClick={(e) => { e.stopPropagation(); follow.toggleFollow(); }} className="absolute -bottom-1.5 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center border-2 border-black"><span className="text-white text-[10px] font-bold leading-none">+</span></button>}
        </button>
        <button className="flex flex-col items-center transition-transform active:scale-125" onClick={(e) => { e.stopPropagation(); interaction.toggleLike(); }}>
          <Heart size={28} className={`drop-shadow-lg transition-colors ${interaction.liked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
          <span className="text-white text-[11px] font-semibold drop-shadow">{fmtN(interaction.likeCount)}</span>
        </button>
        <button className="flex flex-col items-center transition-transform active:scale-110" onClick={(e) => { e.stopPropagation(); setCommentsOpen(true); }}>
          <MessageCircle size={28} className="text-white drop-shadow-lg" />
          <span className="text-white text-[11px] font-semibold drop-shadow">{fmtN(interaction.commentCount)}</span>
        </button>
        <button className="flex flex-col items-center transition-transform active:scale-110" onClick={(e) => { e.stopPropagation(); interaction.recordShare(); }}>
          <Share2 size={26} className="text-white drop-shadow-lg" />
          <span className="text-white text-[11px] font-semibold drop-shadow">{fmtN(interaction.shareCount)}</span>
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-16 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 px-4 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={(e) => { e.stopPropagation(); setProfileModalOpen(true); }} className="flex items-center gap-2">
            {creatorAvatar && <div className="w-8 h-8 rounded-full overflow-hidden border border-white/40 flex-shrink-0"><img src={creatorAvatar} alt="" className="w-full h-full object-cover" /></div>}
            <span className="text-white font-bold text-[15px] drop-shadow-lg">{creatorName}</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); follow.toggleFollow(); }} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${follow.following ? 'bg-white/20 text-white/80' : 'bg-blue-600 text-white'}`}>
            {follow.following ? <UserCheck size={12} /> : <UserPlus size={12} />} {follow.following ? 'Siguiendo' : 'Seguir'}
          </button>
        </div>
        {item.extra && <p className={`text-white/90 text-[13px] mt-1 drop-shadow leading-snug ${captionOpen ? '' : 'line-clamp-2'}`} onClick={(e) => { e.stopPropagation(); setCaptionOpen((v) => !v); }}>{item.extra}</p>}
        {hashtags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1.5">{hashtags.slice(0, captionOpen ? 20 : 5).map((tag) => <span key={tag} className="text-blue-300 text-[11px] font-semibold drop-shadow">#{tag}</span>)}</div>}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-2"><Music size={12} className="text-white/50 flex-shrink-0" /><span className="text-white/50 text-[10px]">{timeAgo(item.created_at)}</span>{duration != null && duration > 0 && <span className="text-white/50 text-[10px]">- {fmtDur(duration)}</span>}</div>
          <span className="text-white/60 text-[10px]">{fmtN(interaction.viewCount)} vistas</span>
        </div>
      </div>

      <ProfileModal userId={creatorId ?? null} open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
      <CommentSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} comments={interaction.comments} loading={interaction.commentsLoading} onLoad={interaction.loadComments} onSubmit={interaction.addComment} />
    </div>
  );
};

// ===============================================================================
// VIDEO SECTION -- TikTok snap-scroll
// ===============================================================================

const VideoSection: React.FC = () => {
  const { items, loading, error, hasMore, loadMore, refresh } = useMexivanzaSection('videos');
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(true);

  useEffect(() => { const ct = containerRef.current; if (!ct) return; const obs = new IntersectionObserver((entries) => { for (const e of entries) { if (e.isIntersecting) { const idx = Number(e.target.getAttribute('data-vidx')); if (!isNaN(idx)) setActiveIdx(idx); } } }, { root: ct, threshold: 0.6 }); ct.querySelectorAll('[data-vidx]').forEach((el) => obs.observe(el)); return () => obs.disconnect(); }, [items.length]);
  useEffect(() => { if (activeIdx >= items.length - 4 && hasMore) loadMore(); }, [activeIdx, items.length, hasMore, loadMore]);

  if (loading && items.length === 0) return <div className="flex-1 flex items-center justify-center bg-black"><div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" /></div>;
  if (error && items.length === 0) return <div className="flex-1 flex items-center justify-center bg-black px-6"><div className="text-center"><p className="text-white/60 text-sm mb-3">{error}</p><button onClick={refresh} className="text-blue-400 text-sm font-semibold">Reintentar</button></div></div>;
  if (items.length === 0) return <div className="flex-1 flex items-center justify-center bg-black"><p className="text-white/60 text-sm">Sin videos disponibles</p></div>;

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-black" style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}>
      {items.map((vid, idx) => (
        <div key={vid.id} data-vidx={idx} style={{ height: '100%', minHeight: '100%', scrollSnapAlign: 'start' }}>
          <TikTokCard item={vid} isActive={idx === activeIdx} shouldLoad={Math.abs(idx - activeIdx) <= 3} muted={globalMuted} onToggleMute={() => setGlobalMuted((m) => !m)} />
        </div>
      ))}
      {hasMore && <div className="flex items-center justify-center bg-black" style={{ height: 80, scrollSnapAlign: 'none' }}><div className="animate-spin h-5 w-5 border-2 border-white/50 border-t-transparent rounded-full" /></div>}
    </div>
  );
};

// ===============================================================================
// LOADING / EMPTY / ERROR
// ===============================================================================

const Skeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-3">{Array.from({ length: count }).map((_, i) => (
    <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-gray-200" /><div className="flex-1 space-y-1.5"><div className="h-3 bg-gray-200 rounded w-28" /><div className="h-2 bg-gray-100 rounded w-20" /></div></div>
      <div className="space-y-2"><div className="h-3 bg-gray-200 rounded w-full" /><div className="h-3 bg-gray-200 rounded w-3/4" /></div>
    </div>
  ))}</div>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="text-center py-16"><p className="text-4xl mb-3">&#x1F4ED;</p><p className="text-sm font-semibold text-gray-700">Sin datos en {label}</p><p className="text-xs text-gray-400 mt-1">El contenido aparecera cuando se agregue en MexiVanza</p></div>
);

const ErrorState: React.FC<{ msg: string; onRetry: () => void }> = ({ msg, onRetry }) => (
  <div className="text-center py-12"><p className="text-sm text-red-500 mb-2">{msg}</p><button onClick={onRetry} className="text-sm text-blue-500 font-medium hover:underline">Reintentar</button></div>
);

// ===============================================================================
// SECTION CONTENT -- renders the right card type per section
// ===============================================================================

const SectionContent: React.FC<{ section: Section }> = ({ section }) => {
  const isSocial = section.dataKey === 'social';
  const isMeximart = section.dataKey === 'meximart';
  const isViajes = section.dataKey === 'viajes';

  const social = useComunidad();
  const generic = useMexivanzaSection(isSocial ? '__skip__' : section.dataKey);

  const posts = social.posts;
  const items = generic.items;
  const loading = isSocial ? social.loading : generic.loading;
  const error = isSocial ? social.error : generic.error;
  const hasMore = isSocial ? social.hasMore : generic.hasMore;
  const loadMore = isSocial ? social.loadMore : generic.loadMore;
  const refresh = isSocial ? social.refresh : generic.refresh;
  const dataLen = isSocial ? posts.length : items.length;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node || !hasMore) return;
    observerRef.current = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: '300px' });
    observerRef.current.observe(node);
  }, [hasMore, loadMore]);

  return (
    <div className="space-y-3">
      {error && !loading && <ErrorState msg={`Error: ${error}`} onRetry={refresh} />}
      {loading && dataLen === 0 && <Skeleton />}
      {!loading && !error && dataLen === 0 && <EmptyState label={section.label} />}
      {isSocial && posts.map((p) => <PostCard key={p.id} post={p} />)}
      {isMeximart && items.map((item) => <MeximartCard key={item.id} item={item} />)}
      {isViajes && items.map((item) => <ViajesCard key={item.id} item={item} />)}
      {hasMore && dataLen > 0 && <div ref={sentinelRef} className="py-4 text-center"><div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" /></div>}
      {!hasMore && dataLen > 0 && <p className="text-center text-xs text-gray-400 py-4">No hay mas contenido</p>}
    </div>
  );
};

// ===============================================================================
// COMUNIDAD PAGE
// ===============================================================================



// ===============================================================================
// FAB -- Floating Action Button for content creation
// ===============================================================================

const CreationFAB: React.FC<{
  section: string;
  onPost: () => void;
  onListing: () => void;
  onVideo: () => void;
}> = ({ section, onPost, onListing, onVideo }) => {
  var fabMap: Record<string, { icon: React.ReactNode; color: string; action: () => void; label: string }> = {
    social: { icon: <PenSquare size={22} />, color: "bg-blue-600 hover:bg-blue-700", action: onPost, label: "Publicar" },
    meximart: { icon: <ShoppingBagIcon size={22} />, color: "bg-emerald-500 hover:bg-emerald-600", action: onListing, label: "Vender" },
    videos: { icon: <Video size={22} />, color: "bg-purple-600 hover:bg-purple-700", action: onVideo, label: "Subir" },
  };
  var cfg = fabMap[section];
  if (!cfg) return null;
  return (
    <button onClick={cfg.action} className={"fixed bottom-6 right-5 z-30 w-14 h-14 rounded-full text-white shadow-lg shadow-black/20 flex items-center justify-center transition-all active:scale-90 " + cfg.color} aria-label={cfg.label}>
      {cfg.icon}
    </button>
  );
};

const Comunidad: React.FC = () => {
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(0);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showListingModal, setShowListingModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const active = SECTIONS[activeIdx];
  const isVid = active.dataKey === 'videos';

  return (
    <div className={`h-screen flex flex-col ${isVid ? 'bg-black' : 'bg-gray-50'}`}>
      <div className={`sticky top-0 z-20 border-b ${isVid ? 'bg-black border-gray-800' : 'bg-white border-gray-100'}`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isVid ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`} aria-label="Volver">
            <ArrowLeft size={18} className={isVid ? 'text-white' : 'text-gray-700'} />
          </button>
          <div className="flex-1">
            <h1 className={`text-lg font-bold ${isVid ? 'text-white' : 'text-gray-900'}`}>Comunidad</h1>
            <p className={`text-[11px] -mt-0.5 ${isVid ? 'text-white/40' : 'text-gray-400'}`}>MexiVanza</p>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex px-3 pb-2 gap-1 min-w-max">
            {SECTIONS.map((sec, idx) => (
              <button key={sec.id} onClick={() => setActiveIdx(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  idx === activeIdx ? 'bg-blue-600 text-white shadow-sm' : isVid ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <span className={`flex-shrink-0 ${idx === activeIdx ? '[&_svg]:brightness-0 [&_svg]:invert' : ''}`}>{sec.icon}</span>
                {sec.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {isVid ? <VideoSection /> : (
        <div className="flex-1 max-w-lg mx-auto w-full px-3 py-4 overflow-y-auto">
          <SectionContent key={active.id} section={active} />
        </div>
      )}
      <CreationFAB section={active.dataKey} onPost={() => setShowPostModal(true)} onListing={() => setShowListingModal(true)} onVideo={() => setShowVideoModal(true)} />
      <CreatePostModal open={showPostModal} onClose={() => setShowPostModal(false)} />
      <CreateListingModal open={showListingModal} onClose={() => setShowListingModal(false)} />
      <CreateVideoModal open={showVideoModal} onClose={() => setShowVideoModal(false)} />
      <CreationFAB section={active.dataKey} onPost={() => setShowPostModal(true)} onListing={() => setShowListingModal(true)} onVideo={() => setShowVideoModal(true)} />
      <CreatePostModal open={showPostModal} onClose={() => setShowPostModal(false)} />
      <CreateListingModal open={showListingModal} onClose={() => setShowListingModal(false)} />
      <CreateVideoModal open={showVideoModal} onClose={() => setShowVideoModal(false)} />
    </div>
  );
};

export default Comunidad;
