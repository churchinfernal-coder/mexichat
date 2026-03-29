/**
 * MEXICHAT �” Perfil (MexiVanza User Profile)
 * 
 * Full in-app profile view pulling real data from MexiVanza Supabase.
 * No external links �” everything rendered natively.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Eye, Calendar, MapPin, UserPlus, UserCheck, Heart, MessageCircle, Share2 } from 'lucide-react';
import { mexivanza } from '@/integrations/mexivanza/client';
import { useFollow } from '@/hooks/useVideoInteractions';

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function memberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'hace unos minutos';
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
}

interface UserProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  nationality: string | null;
  interests: string[];
  followers_count: number;
  following_count: number;
  views_count: number;
  created_at: string;
}

interface UserPost {
  id: string;
  caption: string | null;
  media_urls: any;
  thumbnail_url: string | null;
  type: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
}

const Perfil: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postTab, setPostTab] = useState<'todo' | 'fotos' | 'videos'>('todo');
  const follow = useFollow(userId);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    (async () => {
      try {
        const { data: prof } = await mexivanza
          .from('profiles').select('*').eq('id', userId).maybeSingle();

        if (!prof) { setLoading(false); return; }

        const { data: userPosts } = await mexivanza
          .from('user_posts').select('*').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(50);

        const { count: followersCount } = await mexivanza
          .from('user_follows').select('*', { count: 'exact', head: true })
          .eq('followed_id', userId).eq('status', 'accepted');

        const { count: followingCount } = await mexivanza
          .from('user_follows').select('*', { count: 'exact', head: true })
          .eq('follower_id', userId).eq('status', 'accepted');

        const interests: string[] = Array.isArray(prof.interests)
          ? prof.interests
          : (typeof prof.interests === 'string' ? prof.interests.split(',').map((s: string) => s.trim()) : []);

        setProfile({
          id: prof.id,
          full_name: prof.full_name,
          username: prof.username,
          avatar_url: prof.avatar_url,
          bio: prof.bio,
          location: prof.location ?? prof.city ?? null,
          nationality: prof.nationality ?? null,
          interests,
          followers_count: followersCount ?? 0,
          following_count: followingCount ?? 0,
          views_count: prof.profile_views ?? prof.views_count ?? 0,
          created_at: prof.created_at ?? '',
        });
        setPosts(userPosts ?? []);
      } catch (err) {
        console.error('Profile fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const filteredPosts = posts.filter((p) => {
    if (postTab === 'todo') return true;
    if (postTab === 'fotos') return !p.type || p.type !== 'video';
    if (postTab === 'videos') return p.type === 'video';
    return true;
  });

  const getPostMedia = (p: UserPost): { url: string; type: string }[] => {
    const urls = p.media_urls;
    if (!Array.isArray(urls)) return [];
    return urls.map((item: any) => {
      if (typeof item === 'string') {
        const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(item);
        return { url: item, type: isVideo ? 'video' : 'image' };
      }
      return { url: item.url ?? item.media_url ?? '', type: item.type ?? 'image' };
    }).filter((m) => m.url);
  };

  const getThumb = (p: UserPost): string | null => {
    if (p.thumbnail_url) return p.thumbnail_url;
    const media = getPostMedia(p);
    return media.length > 0 ? media[0].url : null;
  };

  const photosCount = posts.filter(p => !p.type || p.type !== 'video').length;
  const videosCount = posts.filter(p => p.type === 'video').length;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
        <p className="text-gray-500 mb-4">Perfil no encontrado</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 font-semibold">Volver</button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{profile.full_name || 'Usuario'}</h1>
            {profile.username && <p className="text-[11px] text-gray-400 -mt-0.5">@{profile.username}</p>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="bg-white pb-4">
          <div className="flex justify-center pt-6 pb-3">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-200">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl font-bold">
                  {(profile.full_name || '?')[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="text-center px-4 pb-2">
            <h2 className="text-2xl font-bold text-gray-900">{profile.full_name || 'Usuario'}</h2>
            {profile.username && <p className="text-sm text-gray-500">@{profile.username}</p>}
          </div>

          <div className="flex justify-center gap-2 px-4 pb-3">
            <button className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
              <Users size={15} /> Agregar amigo
            </button>
            <button onClick={follow.toggleFollow}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold ${
                follow.following ? 'bg-gray-200 text-gray-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {follow.following ? <UserCheck size={15} /> : <UserPlus size={15} />}
              {follow.following ? 'Siguiendo' : 'Seguir'}
            </button>
          </div>

          <div className="flex justify-center gap-6 px-4 pb-3 text-sm text-gray-600">
            <div className="text-center">
              <p className="font-bold text-gray-900">{fmtN(profile.followers_count)}</p>
              <p className="text-xs text-gray-400">seguidores</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900">{fmtN(profile.following_count)}</p>
              <p className="text-xs text-gray-400">siguiendo</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900">{fmtN(profile.views_count)}</p>
              <p className="text-xs text-gray-400">vistas</p>
            </div>
          </div>

          <div className="flex justify-center gap-3 px-4 pb-2 text-xs text-gray-400">
            {profile.created_at && (
              <span className="flex items-center gap-1"><Calendar size={12} /> Miembro desde {memberSince(profile.created_at)}</span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1"><MapPin size={12} /> {profile.location}</span>
            )}
          </div>

          {profile.bio && <p className="text-sm text-gray-600 text-center px-6 pb-2">{profile.bio}</p>}

          {profile.nationality && (
            <div className="text-center px-4 pb-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">Nacionalidades: {profile.nationality}</span>
            </div>
          )}

          {profile.interests.length > 0 && (
            <div className="px-6 pb-3">
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Intereses</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.interests.map((i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{i}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pt-4 pb-2">
          <h3 className="text-lg font-bold text-gray-900">Publicaciones</h3>
        </div>

        <div className="flex border-b border-gray-200 mx-4 mb-3">
          {([
            { key: 'todo', label: 'Todo', count: posts.length },
            { key: 'fotos', label: 'Fotos', count: photosCount },
            { key: 'videos', label: 'Videos', count: videosCount },
          ] as const).map((tab) => (
            <button key={tab.key} onClick={() => setPostTab(tab.key)}
              className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
                postTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              {tab.label} {tab.count}
            </button>
          ))}
        </div>

        <div className="px-4 space-y-3 pb-6">
          {filteredPosts.map((post) => {
            const media = getPostMedia(post);
            return (
              <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden flex-shrink-0">
                    {profile.avatar_url
                      ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="w-full h-full flex items-center justify-center text-blue-600 font-semibold">{(profile.full_name || '?')[0]}</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{profile.full_name}</p>
                    <p className="text-xs text-gray-400">{timeAgo(post.created_at)}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">public</span>
                </div>

                {post.caption && (
                  <p className="px-4 pb-2 text-sm text-gray-800 whitespace-pre-wrap break-words">{post.caption}</p>
                )}

                {media.length > 0 && (
                  <div className="relative">
                    {media[0].type === 'video' ? (
                      <video src={media[0].url} controls className="w-full max-h-[500px] object-contain bg-black" />
                    ) : (
                      <img src={media[0].url} alt="" className="w-full object-cover max-h-[500px]" loading="lazy" />
                    )}
                    {media.length > 1 && (
                      <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                        1 / {media.length}
                      </div>
                    )}
                  </div>
                )}

                <div className="px-4 pt-2 pb-1 text-xs text-gray-500 border-t border-gray-50">
                  {post.likes_count} me gusta &middot; {post.comments_count} comentarios &middot; {post.shares_count} compartidos
                </div>

                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
                  <button className="flex items-center gap-1.5 text-gray-500"><Heart size={16} /><span className="text-xs">{post.likes_count}</span></button>
                  <button className="flex items-center gap-1.5 text-gray-500"><MessageCircle size={16} /><span className="text-xs">{post.comments_count}</span></button>
                  <button className="flex items-center gap-1.5 text-gray-500"><Share2 size={16} /><span className="text-xs">Compartir</span></button>
                </div>
              </div>
            );
          })}
          {filteredPosts.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-400">Sin publicaciones</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Perfil;
