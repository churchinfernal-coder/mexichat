/**
 * MEXICHAT - Broadcast Channels v1.0
 * Telegram-style one-to-many channels. Only owner can post.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Channel {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  subscriberCount: number;
  createdAt: string;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
}

function mapChannel(row: Record<string, unknown>): Channel {
  return {
    id: row.id as string, ownerId: row.owner_id as string,
    name: row.name as string, description: (row.description as string) || null,
    avatarUrl: (row.avatar_url as string) || null, isPublic: row.is_public as boolean,
    subscriberCount: (row.subscriber_count as number) || 0, createdAt: row.created_at as string,
  };
}

function mapMsg(row: Record<string, unknown>): ChannelMessage {
  return {
    id: row.id as string, channelId: row.channel_id as string,
    senderId: row.sender_id as string, content: row.content as string,
    mediaUrl: (row.media_url as string) || null, mediaType: (row.media_type as string) || null,
    createdAt: row.created_at as string,
  };
}
export function useChannels(userId: string | undefined) {
  const [myChannels, setMyChannels] = useState<Channel[]>([]);
  const [subscribedChannels, setSubscribedChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMyChannels = useCallback(async () => {
    if (!userId) return;
    const { data } = await (supabase.from('channels' as any).select('*') as any)
      .eq('owner_id', userId).order('created_at', { ascending: false });
    if (data) setMyChannels((data as any[]).map(mapChannel));
  }, [userId]);

  const loadSubscribed = useCallback(async () => {
    if (!userId) return;
    const { data: subs } = await (supabase.from('channel_subscribers' as any).select('channel_id') as any)
      .eq('user_id', userId);
    if (!subs || subs.length === 0) { setSubscribedChannels([]); return; }
    const ids = (subs as any[]).map((s: any) => s.channel_id);
    const { data } = await (supabase.from('channels' as any).select('*') as any)
      .in('id', ids).order('updated_at', { ascending: false });
    if (data) setSubscribedChannels((data as any[]).map(mapChannel));
  }, [userId]);

  const createChannel = useCallback(async (name: string, description?: string, isPublic = true) => {
    if (!userId) return null;
    const { data, error } = await (supabase.from('channels' as any).insert({
      owner_id: userId, name, description: description || null, is_public: isPublic,
    } as any) as any).select('*').single();
    if (error) { toast.error('Error al crear canal'); return null; }
    const channel = mapChannel(data as Record<string, unknown>);
    setMyChannels(prev => [channel, ...prev]);
    toast.success('Canal creado');
    return channel;
  }, [userId]);

  const subscribe = useCallback(async (channelId: string) => {
    if (!userId) return;
    const { error } = await (supabase.from('channel_subscribers' as any)
      .insert({ channel_id: channelId, user_id: userId } as any) as any);
    if (error && !error.message.includes('duplicate')) { toast.error('Error al suscribirse'); return; }
    toast.success('Suscrito al canal');
    loadSubscribed();
  }, [userId, loadSubscribed]);

  const unsubscribe = useCallback(async (channelId: string) => {
    if (!userId) return;
    await (supabase.from('channel_subscribers' as any).delete() as any)
      .eq('channel_id', channelId).eq('user_id', userId);
    setSubscribedChannels(prev => prev.filter(c => c.id !== channelId));
    toast.success('Desuscrito del canal');
  }, [userId]);

  const postMessage = useCallback(async (channelId: string, content: string, mediaUrl?: string, mediaType?: string) => {
    if (!userId) return;
    const { data, error } = await (supabase.from('channel_messages' as any).insert({
      channel_id: channelId, sender_id: userId, content,
      media_url: mediaUrl || null, media_type: mediaType || null,
    } as any) as any).select('*').single();
    if (error) { toast.error('Error al publicar'); return; }
    const msg = mapMsg(data as Record<string, unknown>);
    setMessages(prev => [...prev, msg]);
    await (supabase.from('channels' as any).update({ updated_at: new Date().toISOString() } as any) as any).eq('id', channelId);
  }, [userId]);

  const loadMessages = useCallback(async (channelId: string) => {
    setLoading(true);
    const { data } = await (supabase.from('channel_messages' as any).select('*') as any)
      .eq('channel_id', channelId).order('created_at', { ascending: true }).limit(200);
    if (data) setMessages((data as any[]).map(mapMsg));
    setLoading(false);
  }, []);

  const openChannel = useCallback(async (channel: Channel) => {
    setActiveChannel(channel);
    await loadMessages(channel.id);
  }, [loadMessages]);

  const browsePublic = useCallback(async (query?: string) => {
    let q = (supabase.from('channels' as any).select('*') as any)
      .eq('is_public', true).order('subscriber_count', { ascending: false }).limit(50);
    if (query) q = q.ilike('name', '%' + query + '%');
    const { data } = await q;
    return data ? (data as any[]).map(mapChannel) : [];
  }, []);

  const deleteChannel = useCallback(async (channelId: string) => {
    await (supabase.from('channel_messages' as any).delete() as any).eq('channel_id', channelId);
    await (supabase.from('channel_subscribers' as any).delete() as any).eq('channel_id', channelId);
    await (supabase.from('channels' as any).delete() as any).eq('id', channelId);
    setMyChannels(prev => prev.filter(c => c.id !== channelId));
    if (activeChannel?.id === channelId) { setActiveChannel(null); setMessages([]); }
    toast.success('Canal eliminado');
  }, [activeChannel]);

  useEffect(() => {
    if (!activeChannel) return;
    const ch = supabase.channel('ch-msgs:' + activeChannel.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_messages',
        filter: 'channel_id=eq.' + activeChannel.id }, (payload) => {
        const msg = mapMsg(payload.new as Record<string, unknown>);
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeChannel]);

  useEffect(() => { loadMyChannels(); loadSubscribed(); }, [loadMyChannels, loadSubscribed]);

  return {
    myChannels, subscribedChannels, activeChannel, messages, loading,
    createChannel, subscribe, unsubscribe, postMessage, openChannel,
    browsePublic, deleteChannel, setActiveChannel, loadMyChannels, loadSubscribed,
  };
}