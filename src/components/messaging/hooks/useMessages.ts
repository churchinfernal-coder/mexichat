import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { MessageEncryption } from '@/utils/encryption-enterprise';
import { sendPushNotification } from '@/utils/pushNotify';
import type { PrivateMessage } from '../types';

const MESSAGES_PER_PAGE = 50;

const PRIVATE_MESSAGES_TABLE = 'private_messages' as const;
const CONVERSATIONS_TABLE = 'conversations' as const;
const PROFILES_TABLE = 'profiles' as const;

type DbPrivateMessage = Database['public']['Tables']['private_messages']['Row'];
type DbConversation = Database['public']['Tables']['conversations']['Row'];
type DbProfile = Database['public']['Tables']['profiles']['Row'];

type ConversationParticipants = {
  user_1: string;
  user_2: string;
};

type MessageMutation = {
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url?: string;
  media_type?: PrivateMessage['media_type'];
  reply_to?: string;
  is_forwarded?: boolean;
};

function normalizeMediaType(value: string | null | undefined): PrivateMessage['media_type'] {
  switch (value) {
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'location':
      return value;
    default:
      return null;
  }
}

function normalizeMessage(message: Partial<DbPrivateMessage> & Pick<DbPrivateMessage, 'id' | 'sender_id' | 'content'>): PrivateMessage {
  return {
    id: message.id,
    conversation_id: message.conversation_id ?? '',
    sender_id: message.sender_id,
    content: message.content,
    media_url: message.media_url ?? null,
    media_type: normalizeMediaType(message.media_type),
    is_read: Boolean(message.is_read),
    created_at: message.created_at ?? new Date().toISOString(),
    edited_at: message.edited_at ?? null,
    reply_to: message.reply_to ?? null,
    is_forwarded: message.is_forwarded ?? false,
  };
}

function getConversationParticipants(conversation: Pick<DbConversation, 'user_1' | 'user_2'> | null): ConversationParticipants | null {
  if (!conversation?.user_1 || !conversation.user_2) return null;
  return { user_1: conversation.user_1, user_2: conversation.user_2 };
}

function getDeletedMessageId(payloadOld: Record<string, unknown> | null): string | null {
  return typeof payloadOld?.id === 'string' ? payloadOld.id : null;
}

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
        console.error('[DECRYPT] Failed:', error);
        return '[\uD83D\uDD12 Mensaje cifrado]';
      }
    }
    return content;
  }, []);

  // ─── Media type display helpers ───
  const mediaPreview = (mediaType?: string | null): string => {
    switch (mediaType) {
      case 'image': return '\uD83D\uDCF7 Imagen';
      case 'video': return '\uD83C\uDFA5 Video';
      case 'audio': return '\uD83C\uDFB5 Audio';
      case 'document': return '\uD83D\uDCC4 Documento';
      default: return '\uD83D\uDCCE Archivo';
    }
  };

  const mediaPushText = (mediaType?: string | null): string => {
    switch (mediaType) {
      case 'image': return '\uD83D\uDCF7 Te envi\u00F3 una imagen';
      case 'video': return '\uD83C\uDFA5 Te envi\u00F3 un video';
      case 'audio': return '\uD83C\uDFB5 Te envi\u00F3 un audio';
      case 'document': return '\uD83D\uDCC4 Te envi\u00F3 un documento';
      default: return '\uD83D\uDCCE Te envi\u00F3 un archivo';
    }
  };

  const ENCRYPTED_NOTIFICATION_PLACEHOLDER = '\uD83D\uDD12 Mensaje cifrado';

  // ─── Fetch initial messages ───
  const fetchMessages = useCallback(async () => {
    if (!conversationId) { setMessages([]); return; }

    setLoading(true);
    const { data, error } = await supabase
      .from(PRIVATE_MESSAGES_TABLE)
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE);

    if (!error && data) {
      const reversed = data.map(normalizeMessage).reverse();

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
          .map(normalizeMessage)
          .filter((message) => !message.is_read && message.sender_id !== userId)
          .map((message) => message.id);

        if (unreadIds.length > 0) {
          await supabase
            .from(PRIVATE_MESSAGES_TABLE)
            .update({ is_read: true })
            .in('id', unreadIds);
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

    const { data, error } = await supabase
      .from(PRIVATE_MESSAGES_TABLE)
      .select('*')
      .eq('conversation_id', conversationId)
      .lt('created_at', oldestMessage.created_at)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE);

    if (!error && data) {
      const reversed = data.map(normalizeMessage).reverse();

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
          const newMsg = normalizeMessage(payload.new as Partial<DbPrivateMessage> & Pick<DbPrivateMessage, 'id' | 'sender_id' | 'content'>);

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
            void supabase
              .from(PRIVATE_MESSAGES_TABLE)
              .update({ is_read: true })
              .eq('id', newMsg.id);
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => {
          const updated = normalizeMessage(payload.new as Partial<DbPrivateMessage> & Pick<DbPrivateMessage, 'id' | 'sender_id' | 'content'>);
          setMessages(prev =>
            prev.map(m => m.id === updated.id
              ? { ...m, is_read: updated.is_read, edited_at: updated.edited_at }
              : m
            )
          );
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'private_messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => {
          const deletedId = getDeletedMessageId(payload.old as Record<string, unknown> | null);
          if (deletedId) {
            setMessages(prev => prev.filter(m => m.id !== deletedId));
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Messages] Realtime connected: ${conversationId.slice(0, 8)}`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Messages] Realtime ${status} - reconnecting in 3s`);
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
  const sendMessage = async (
    content: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'video' | 'audio' | 'document' | 'location',
    replyTo?: string,
    isForwarded?: boolean,
  ) => {
    if (!conversationId || !userId || (!content.trim() && !mediaUrl)) return;

    // Get conversation to find recipient
    const { data: convo } = await supabase
      .from(CONVERSATIONS_TABLE)
      .select('user_1, user_2')
      .eq('id', conversationId)
      .single();

    const participants = getConversationParticipants(convo);
    if (!participants) throw new Error('Conversation not found');

    const recipientId = participants.user_1 === userId ? participants.user_2 : participants.user_1;
    let encryptedContent = content.trim();

    // Carrier-grade policy: never send plaintext when encryption is expected.
    if (recipientId && encryptedContent) {
      if (!MessageEncryption.isInitialized()) {
        throw new Error('E2EE is not ready. Retry after encryption initializes.');
      }

      encryptedContent = await MessageEncryption.encrypt(content.trim(), recipientId);
      if (!MessageEncryption.isEncrypted(encryptedContent)) {
        throw new Error('E2EE failed: plaintext fallback blocked.');
      }
    }

    // Build message
    const messageData: MessageMutation = {
      conversation_id: conversationId,
      sender_id: userId,
      content: encryptedContent || '',
    };
    if (mediaUrl) messageData.media_url = mediaUrl;
    if (mediaType) messageData.media_type = mediaType;
    if (replyTo) messageData.reply_to = replyTo;
    if (isForwarded) messageData.is_forwarded = true;

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
      reply_to: replyTo || null,
      is_forwarded: isForwarded || false,
    };

    setMessages(prev => [...prev, optimisticMsg]);

    // ═══ DB INSERT ═══
    const { data: inserted, error } = await supabase
      .from(PRIVATE_MESSAGES_TABLE)
      .insert(messageData as never)
      .select('*')
      .single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      throw error;
    }

    // Replace optimistic with real message
    if (inserted) {
      const normalizedInserted = normalizeMessage(inserted as Partial<DbPrivateMessage> & Pick<DbPrivateMessage, 'id' | 'sender_id' | 'content'>);
      setMessages(prev =>
        prev.map(m => m.id === optimisticId
          ? { ...normalizedInserted, content: content.trim() }
          : m
        )
      );
    }

    // ═══ UPDATE CONVERSATION — encrypted preview ═══
    const previewText = MessageEncryption.isInitialized()
      ? '\uD83D\uDD12 Mensaje cifrado'
      : content.trim().slice(0, 100);

    const displayPreview = mediaUrl ? mediaPreview(mediaType) : previewText;

    await supabase
      .from(CONVERSATIONS_TABLE)
      .update({
        last_message: displayPreview,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // ═══ Get sender profile ═══
    let senderName = 'Nuevo mensaje';
    let senderAvatar: string | null = null;

    try {
      const { data: myProfile } = await supabase
        .from(PROFILES_TABLE)
        .select('full_name, avatar_url')
        .eq('id', userId)
        .single();

      const typedProfile = myProfile as Pick<DbProfile, 'full_name' | 'avatar_url'> | null;
      senderName = typedProfile?.full_name || 'Nuevo mensaje';
      senderAvatar = typedProfile?.avatar_url || null;
    } catch (profileError) {
      console.warn('[Messages] Failed to load sender profile for push metadata', profileError);
    }

    const notifBody = mediaUrl
      ? mediaPushText(mediaType)
      : ENCRYPTED_NOTIFICATION_PLACEHOLDER;

    // ═══ PUSH NOTIFICATION ═══
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
    } catch (pushError) {
      console.warn('[Messages] Push notification failed', pushError);
    }

    // ═══ IN-APP BROADCAST ═══
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
                preview: mediaUrl ? mediaPreview(mediaType) : ENCRYPTED_NOTIFICATION_PLACEHOLDER,
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
        setTimeout(() => { supabase.removeChannel(notifyChannel); resolve(); }, 3000);
      });
    } catch (broadcastError) {
      console.warn('[Messages] In-app broadcast failed', broadcastError);
    }
  };

  // ─── Delete message ───
  const deleteMessage = async (messageId: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from(PRIVATE_MESSAGES_TABLE)
      .delete()
      .eq('id', messageId)
      .eq('sender_id', userId);

    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
    return !error;
  };

  // ─── Edit message ───
  const editMessage = async (messageId: string, newContent: string) => {
    if (!userId || !newContent.trim()) return false;

    let encryptedContent = newContent.trim();
    // Get conversation to find recipient for encryption
    const { data: convo } = await supabase
      .from(CONVERSATIONS_TABLE)
      .select('user_1, user_2')
      .eq('id', conversationId)
      .single();

    const participants = getConversationParticipants(convo);
    if (!participants) return false;

    const recipientId = participants.user_1 === userId ? participants.user_2 : participants.user_1;

    if (!MessageEncryption.isInitialized()) {
      return false;
    }

    encryptedContent = await MessageEncryption.encrypt(newContent.trim(), recipientId);
    if (!MessageEncryption.isEncrypted(encryptedContent)) {
      return false;
    }

    const editedAt = new Date().toISOString();
    const { error } = await supabase
      .from(PRIVATE_MESSAGES_TABLE)
      .update({ content: encryptedContent, edited_at: editedAt })
      .eq('id', messageId)
      .eq('sender_id', userId);

    if (!error) {
      setMessages(prev =>
        prev.map(m => m.id === messageId
          ? { ...m, content: newContent.trim(), edited_at: editedAt }
          : m
        )
      );
    }
    return !error;
  };

  // ─── Start or find conversation ───
  const startConversation = async (otherUserId: string): Promise<string> => {
    if (!userId) throw new Error('Not authenticated');

    const { data: existing } = await supabase
      .from(CONVERSATIONS_TABLE)
      .select('id')
      .or(`and(user_1.eq.${userId},user_2.eq.${otherUserId}),and(user_1.eq.${otherUserId},user_2.eq.${userId})`)
      .limit(1);

    if (existing && existing.length > 0 && existing[0].id) return existing[0].id;

    const { data: newConvo, error } = await supabase
      .from(CONVERSATIONS_TABLE)
      .insert({
        user_1: userId,
        user_2: otherUserId,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;
    if (!newConvo?.id) throw new Error('Conversation creation failed');
    return newConvo.id;
  };

  return {
    messages,
    loading,
    hasMore,
    loadingMore,
    loadMore,
    sendMessage,
    deleteMessage,
    editMessage,
    startConversation,
    refetch: fetchMessages,
  };
}