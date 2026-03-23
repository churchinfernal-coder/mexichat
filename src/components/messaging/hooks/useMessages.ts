import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageEncryption } from '@/utils/encryption-enterprise';
import { sendPushNotification } from '@/utils/pushNotify';
import type { PrivateMessage } from '../types';

const MESSAGES_PER_PAGE = 50;

export function useMessages(conversationId: string | null, userId: string | undefined) {
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Decrypt helper ───
  const decryptContent = useCallback(async (content: string, senderId: string): Promise<string> => {
    if (MessageEncryption.isEncrypted(content) && MessageEncryption.isInitialized()) {
      try {
        return await MessageEncryption.decrypt(content, senderId);
      } catch (error) {
        console.error('❌ [DECRYPT] Failed:', error);
        return '[🔒 Mensaje cifrado]';
      }
    }
    return content;
  }, []);

  // ─── Fetch initial messages ───
  const fetchMessages = useCallback(async () => {
    if (!conversationId) { setMessages([]); return; }

    setLoading(true);
    const { data, error } = await (supabase
      .from('private_messages' as any)
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE) as any);

    if (!error && data) {
      const reversed = (data as PrivateMessage[]).reverse();

      const decrypted = await Promise.all(
        reversed.map(async (msg) => ({
          ...msg,
          content: await decryptContent(msg.content, msg.sender_id),
        }))
      );

      setMessages(decrypted);
      setHasMore(data.length === MESSAGES_PER_PAGE);

      // Mark unread as read
      if (userId) {
        const unreadIds = data
          .filter((m: any) => !m.is_read && m.sender_id !== userId)
          .map((m: any) => m.id);

        if (unreadIds.length > 0) {
          await (supabase
            .from('private_messages' as any)
            .update({ is_read: true } as any)
            .in('id', unreadIds) as any);
        }
      }
    }
    setLoading(false);
  }, [conversationId, userId, decryptContent]);

  // ─── Load older messages (infinite scroll) ───
  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore || loadingMore || messages.length === 0) return;

    setLoadingMore(true);
    const oldestMessage = messages[0];

    const { data, error } = await (supabase
      .from('private_messages' as any)
      .select('*')
      .eq('conversation_id', conversationId)
      .lt('created_at', oldestMessage.created_at)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE) as any);

    if (!error && data) {
      const reversed = (data as PrivateMessage[]).reverse();

      const decrypted = await Promise.all(
        reversed.map(async (msg) => ({
          ...msg,
          content: await decryptContent(msg.content, msg.sender_id),
        }))
      );

      setMessages(prev => [...decrypted, ...prev]);
      setHasMore(data.length === MESSAGES_PER_PAGE);
    }
    setLoadingMore(false);
  }, [conversationId, hasMore, loadingMore, messages, decryptContent]);

  // ─── Initial fetch ───
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ─── Realtime subscription with auto-reconnection ───
  useEffect(() => {
    if (!conversationId) return;

    const subscribe = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`messages-${conversationId}-${Date.now()}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, async (payload) => {
          const newMsg = payload.new as PrivateMessage;

          const decryptedContent = await decryptContent(newMsg.content, newMsg.sender_id);
          const decryptedMsg = { ...newMsg, content: decryptedContent };

          setMessages(prev => {
            // Deduplicate (might already exist from optimistic insert)
            const withoutOptimistic = prev.filter(m =>
              !m.id.startsWith('optimistic-') || m.sender_id !== newMsg.sender_id
            );
            if (withoutOptimistic.find(m => m.id === decryptedMsg.id)) return withoutOptimistic;
            return [...withoutOptimistic, decryptedMsg];
          });

          // Auto mark as read if receiver has conversation open
          if (userId && newMsg.sender_id !== userId) {
            (supabase
              .from('private_messages' as any)
              .update({ is_read: true } as any)
              .eq('id', newMsg.id) as any);
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => {
          const updated = payload.new as PrivateMessage;
          setMessages(prev =>
            prev.map(m => m.id === updated.id
              ? { ...m, is_read: updated.is_read, edited_at: (updated as any).edited_at }
              : m
            )
          );
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Messages] ✅ Realtime connected: ${conversationId.slice(0, 8)}`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Messages] ⚠️ Realtime ${status} — reconnecting in 3s`);
            reconnectTimerRef.current = setTimeout(subscribe, 3000);
          }
        });

      channelRef.current = channel;
    };

    subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [conversationId, userId, decryptContent]);

  // ─── Send message ───
  const sendMessage = async (content: string, mediaUrl?: string, mediaType?: 'image' | 'video') => {
    if (!conversationId || !userId || (!content.trim() && !mediaUrl)) return;

    // Get conversation to find recipient
    const { data: convo } = await (supabase
      .from('conversations' as any)
      .select('user_1, user_2')
      .eq('id', conversationId)
      .single() as any);

    if (!convo) throw new Error('Conversation not found');

    const recipientId = convo.user_1 === userId ? convo.user_2 : convo.user_1;
    let encryptedContent = content.trim();

    // Encrypt if available
    if (MessageEncryption.isInitialized() && recipientId && encryptedContent) {
      try {
        encryptedContent = await MessageEncryption.encrypt(content.trim(), recipientId);
      } catch (error) {
        console.error('❌ [ENCRYPTION] Failed, sending unencrypted:', error);
        encryptedContent = content.trim();
      }
    }

    // Build message
    const messageData: any = {
      conversation_id: conversationId,
      sender_id: userId,
      content: encryptedContent || '',
    };
    if (mediaUrl) messageData.media_url = mediaUrl;
    if (mediaType) messageData.media_type = mediaType;

    // ═══ OPTIMISTIC INSERT — show message instantly ═══
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg: PrivateMessage = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: userId,
      content: content.trim(),
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      is_read: false,
      created_at: new Date().toISOString(),
      reply_to: null,
      is_forwarded: false,
    } as any;

    setMessages(prev => [...prev, optimisticMsg]);

    // ═══ DB INSERT ═══
    const { data: inserted, error } = await (supabase
      .from('private_messages' as any)
      .insert(messageData)
      .select('*')
      .single() as any);

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      throw error;
    }

    // Replace optimistic with real message
    if (inserted) {
      setMessages(prev =>
        prev.map(m => m.id === optimisticId
          ? { ...inserted, content: content.trim() }
          : m
        )
      );
    }

    // ═══ UPDATE CONVERSATION — encrypted preview ═══
    const previewText = MessageEncryption.isInitialized()
      ? '🔒 Mensaje cifrado'
      : content.trim().slice(0, 100);

    const displayPreview = mediaUrl
      ? (mediaType === 'image' ? '📷 Imagen' : '🎥 Video')
      : previewText;

    await (supabase
      .from('conversations' as any)
      .update({
        last_message: displayPreview,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', conversationId) as any);

    // ═══ Get sender profile (used by both push + in-app notify) ═══
    let senderName = 'Nuevo mensaje';
    let senderAvatar: string | null = null;

    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', userId)
        .single();

      senderName = (myProfile as any)?.full_name || 'Nuevo mensaje';
      senderAvatar = (myProfile as any)?.avatar_url || null;
    } catch {}

    const notifBody = mediaUrl
      ? (mediaType === 'image' ? '📷 Te envió una imagen' : '🎥 Te envió un video')
      : content.trim().slice(0, 100);

    // ═══ 🔔 PUSH NOTIFICATION — delivers when app is closed ═══
    try {
      await sendPushNotification({
        targetUserId: recipientId,
        type: 'message',
        title: senderName,
        body: notifBody,
        fromUserId: userId,
        conversationId,
        avatarUrl: senderAvatar,
      });
    } catch {}

    // ═══ 📢 IN-APP BROADCAST — delivers when app is open but in different conversation ═══
    try {
      const notifyChannel = supabase.channel(`msg-notify:${recipientId}`);
      await new Promise<void>((resolve) => {
        notifyChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            notifyChannel.send({
              type: 'broadcast',
              event: 'new-message',
              payload: {
                to: recipientId,
                from: userId,
                fromName: senderName,
                preview: mediaUrl
                  ? (mediaType === 'image' ? '📷 Imagen' : '🎥 Video')
                  : content.trim().slice(0, 100),
                conversationId,
                avatarUrl: senderAvatar,
              },
            }).then(() => {
              setTimeout(() => supabase.removeChannel(notifyChannel), 500);
              resolve();
            }).catch(() => {
              supabase.removeChannel(notifyChannel);
              resolve();
            });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            supabase.removeChannel(notifyChannel);
            resolve();
          }
        });
        // Safety timeout
        setTimeout(() => {
          supabase.removeChannel(notifyChannel);
          resolve();
        }, 3000);
      });
    } catch {}
  };

  // ─── Start or find conversation ───
  const startConversation = async (otherUserId: string): Promise<string> => {
    if (!userId) throw new Error('Not authenticated');

    const { data: existing } = await (supabase
      .from('conversations' as any)
      .select('id')
      .or(`and(user_1.eq.${userId},user_2.eq.${otherUserId}),and(user_1.eq.${otherUserId},user_2.eq.${userId})`)
      .limit(1) as any);

    if (existing && existing.length > 0) return existing[0].id;

    const { data: newConvo, error } = await (supabase
      .from('conversations' as any)
      .insert({
        user_1: userId,
        user_2: otherUserId,
        last_message_at: new Date().toISOString(),
      } as any)
      .select('id')
      .single() as any);

    if (error) throw error;
    return newConvo.id;
  };

  return {
    messages,
    loading,
    hasMore,
    loadingMore,
    loadMore,
    sendMessage,
    startConversation,
    refetch: fetchMessages,
  };
}