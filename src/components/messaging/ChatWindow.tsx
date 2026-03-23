/**
 * MEXICHAT â€” Enterprise Chat Window v3.0
 *
 * v3.0 (v8 system):
 * - Message reactions (emoji on messages)
 * - Message editing (edit sent messages within 15min)
 * - Pinned messages integration
 * - Message delivery status (âœ“ âœ“âœ“ blue)
 * - Starred messages
 * - Link previews
 * - Thread replies
 * - Archive / Export actions
 * - Draft restore
 * - Wallpaper support
 * - Search trigger
 * - Shared media trigger
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Phone, Video, MoreVertical, Send,
  Smile, Paperclip, Check, CheckCheck, Ban,
  Flag, Trash2, VolumeX, X, Mic, PhoneOff,
  VideoOff, MicOff, Reply, Forward, CornerUpRight,
  Timer, CheckSquare, Edit3, Pin, Star, Search,
  Image as ImageIcon, Download, Archive, SmilePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTyping } from '@/hooks/useTyping';
import { useCallContext } from '@/contexts/CallContext';
import { useGlobalCallManager } from '@/hooks/useGlobalCallManager';
import { useE2EE } from '@/hooks/useE2EE';
import TypingIndicator from '@/components/chat/TypingIndicator';
import ImageLightbox from '@/components/chat/ImageLightbox';
import EncryptionBadge from '@/components/chat/EncryptionBadge';
import AudioRecorderButton from '@/components/chat/AudioRecorderButton';
import EmojiPicker from '@/components/chat/EmojiPicker';
import BulkActionBar from '@/components/chat/BulkActionBar';
import DisappearingTimerPicker from '@/components/chat/DisappearingTimerPicker';
import { CHAT_CONFIG } from '@/config/chat';
import { playNotificationSound } from '@/utils/sounds';
import { compressImage } from '@/utils/imageCompression';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useBulkSelect } from '@/hooks/useBulkSelect';
import { useDisappearingMessages, type DisappearTimer } from '@/hooks/useDisappearingMessages';
import { formatAudioDuration } from '@/utils/audioEncoder';

// v8 components
import ReactionPicker from '@/components/chat/ReactionPicker';
import ReactionBadge from '@/components/chat/ReactionBadge';
import MessageStatusIcon from '@/components/chat/MessageStatusIcon';
import LinkPreviewCard from '@/components/chat/LinkPreviewCard';

// v8 types
import type { Reaction, MessageReactions } from '@/hooks/useMessageReactions';
import type { EditState } from '@/hooks/useMessageEdit';
import type { PinnedMessage } from '@/hooks/usePinnedMessages';
import type { DeliveryState } from '@/hooks/useDeliveryStatus';
import type { LinkPreviewData } from '@/hooks/useLinkPreview';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface Message {
  id: string;
  senderId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  isRead: boolean;
  createdAt: string;
  replyTo: string | null;
  isForwarded: boolean;
  expiresAt?: string | null;
  iv?: string | null;
  editedAt?: string | null;
}

interface ChatWindowProps {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string | null;
  otherUser: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    isOnline: boolean;
    lastSeen: string | null;
  };
  messages: Message[];
  conversationId: string;
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string, replyTo?: string, isForwarded?: boolean) => void;
  onBack: () => void;
  onCall: (type: 'audio' | 'video') => void;
  onBlock: () => void;
  onReport: () => void;
  onMute: () => void;
  onDelete: () => void;
  onForward: (message: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onBulkDelete?: (ids: Set<string>) => void;
  isEncrypted?: boolean;
  isMuted: boolean;
  isBlocked: boolean;
  autoAcceptCall?: 'audio' | 'video' | null;
  // â”€â”€ v8 props â”€â”€
  reactions?: MessageReactions;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  editingMessage?: EditState | null;
  onStartEdit?: (messageId: string, content: string) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (newContent: string) => Promise<boolean>;
  canEditMessage?: (senderId: string, createdAt: string) => boolean;
  pinnedMessages?: PinnedMessage[];
  onPinMessage?: (messageId: string, content: string) => void;
  onUnpinMessage?: (pinId: string) => void;
  onShowPinned?: () => void;
  deliveryStatus?: { getStatus: (messageId: string, isRead?: boolean) => DeliveryState };
  starredMessages?: { isStarred: (messageId: string) => boolean };
  onToggleStar?: (messageId: string, content: string) => void;
  onArchive?: () => void;
  isArchived?: boolean;
  onExport?: (format: 'txt' | 'json' | 'csv') => void;
  onOpenSearch?: () => void;
  onOpenMedia?: () => void;
  onJumpToMessage?: (messageId: string) => void;
  draft?: string;
  wallpaper?: string | null;
  linkPreview?: { previews: Map<string, LinkPreviewData>; extractUrl: (text: string) => string | null; fetchPreview: (url: string) => Promise<LinkPreviewData | null> };
  threadReplies?: { openThread: (parentId: string, parentContent: string, parentSender: string, table: 'private_messages' | 'group_messages') => void };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function formatLastSeen(dateStr: string | null, isOnline: boolean): string {
  if (isOnline) return 'En l\u00EDnea';
  if (!dateStr) return 'Desconectado';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return 'Hace un momento';
  if (diff < 60) return `Hace ${diff} min`;
  if (diff < 1440) return `Hoy a las ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return `\u00DAlt. vez ${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
}

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function groupMessagesByDate(messages: Message[]): Map<string, Message[]> {
  const groups = new Map<string, Message[]>();
  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString();
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(msg);
  }
  return groups;
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DECRYPTED MESSAGE CONTENT COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const DecryptedBubble: React.FC<{
  msg: Message;
  currentUserId: string;
  otherUserId: string;
  e2ee: ReturnType<typeof useE2EE>;
}> = ({ msg, currentUserId, otherUserId, e2ee }) => {
  const [displayText, setDisplayText] = useState(msg.content);
  const [decrypting, setDecrypting] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    attemptedRef.current = false;
    setDisplayText(msg.content);
  }, [msg.id, msg.content]);

  useEffect(() => {
    if (attemptedRef.current) return;
    if (!msg.iv || !msg.content || !e2ee.isReady) return;
    attemptedRef.current = true;
    setDecrypting(true);
    const senderId = msg.senderId === currentUserId ? otherUserId : msg.senderId;
    e2ee.decrypt(msg.content, msg.iv, senderId).then((plaintext) => {
      if (plaintext) setDisplayText(plaintext);
      setDecrypting(false);
    }).catch(() => { setDecrypting(false); });
  }, [msg.id, msg.iv, msg.content, e2ee.isReady, e2ee, currentUserId, otherUserId, msg.senderId]);

  if (decrypting) {
    return <div className="mensajes-msg-bubble" id={`msg-${msg.id}`} style={{ opacity: 0.6, fontStyle: 'italic' }}>ðŸ”“ Descifrando...</div>;
  }
  return <div className="mensajes-msg-bubble" id={`msg-${msg.id}`}>{displayText}</div>;
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const ChatWindow: React.FC<ChatWindowProps> = ({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  otherUser,
  messages,
  conversationId,
  onSendMessage,
  onBack,
  onCall: _onCall,
  onBlock,
  onReport,
  onMute,
  onDelete,
  onForward,
  onDeleteMessage,
  onBulkDelete,
  isEncrypted = false,
  isMuted,
  isBlocked,
  autoAcceptCall = null,
  // v8 props
  reactions,
  onToggleReaction,
  editingMessage,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  canEditMessage,
  pinnedMessages,
  onPinMessage,
  onUnpinMessage,
  onShowPinned,
  deliveryStatus,
  starredMessages,
  onToggleStar,
  onArchive,
  isArchived,
  onExport,
  onOpenSearch,
  onOpenMedia,
  onJumpToMessage,
  draft,
  wallpaper,
  linkPreview,
  threadReplies,
}) => {
  const [inputText, setInputText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTimerPicker, setShowTimerPicker] = useState(false);

  // v8 local state
  const [editText, setEditText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSendRef = useRef(0);
  const notifiedMessageIds = useRef(new Set<string>());
  const initialLoadComplete = useRef(false);

  // Restore draft
  useEffect(() => {
    if (draft && !inputText) setInputText(draft);
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync edit text
  useEffect(() => {
    if (editingMessage) { setEditText(editingMessage.originalContent); inputRef.current?.focus(); }
    else setEditText('');
  }, [editingMessage]);

  const e2ee = useE2EE(currentUserId);

  // Call system
  const { activeCall } = useCallContext();
  const { initiateCall, endActiveCall, toggleMute, toggleVideo } = useGlobalCallManager();

  const startCall = useCallback(async (type: 'audio' | 'video') => {
    if (!currentUserId || !otherUser?.id || !conversationId) return;
    if (activeCall?.active) { toast.error('Ya estas en una llamada'); return; }
    try { await initiateCall(otherUser.id, type, conversationId); }
    catch (err: any) { toast.error(err.message || 'Error al iniciar la llamada'); }
  }, [currentUserId, otherUser?.id, conversationId, initiateCall, activeCall]);

  // Feature hooks
  const audioRecorder = useAudioRecorder();
  const bulkSelect = useBulkSelect();
  const disappearing = useDisappearingMessages(conversationId);
  const { isOtherTyping, sendTyping, sendStopTyping } = useTyping({ conversationId, currentUserId, otherUserId: otherUser.id });

  const visibleMessages = React.useMemo(() => {
    return messages.filter(m => !disappearing.isExpired(m.expiresAt ?? null));
  }, [messages, disappearing]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SMART NOTIFICATION SOUND
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (!initialLoadComplete.current) {
      if (visibleMessages.length > 0) {
        for (const msg of visibleMessages) notifiedMessageIds.current.add(msg.id);
        initialLoadComplete.current = true;
      }
      return;
    }
    for (const msg of visibleMessages) {
      if (msg.senderId !== currentUserId && !notifiedMessageIds.current.has(msg.id)) {
        notifiedMessageIds.current.add(msg.id);
        playNotificationSound('message');
        break;
      }
    }
    for (const msg of visibleMessages) notifiedMessageIds.current.add(msg.id);
  }, [visibleMessages, currentUserId]);

  useEffect(() => { notifiedMessageIds.current.clear(); initialLoadComplete.current = false; }, [conversationId]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // UI EVENT HANDLERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  useEffect(() => {
    const handleClick = () => { setContextMenu(null); setShowReactionPicker(null); };
    if (contextMenu || showReactionPicker) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu, showReactionPicker]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false); };
    if (showSettings) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSettings]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { const panel = document.querySelector('.chat-action-panel'); if (panel && !panel.contains(e.target as Node)) setShowActions(false); };
    if (showActions) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActions]);

  useEffect(() => { if (replyingTo) inputRef.current?.focus(); }, [replyingTo]);
  useEffect(() => { bulkSelect.stopSelecting(); }, [conversationId]);

  const messageMap = React.useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of visibleMessages) map.set(m.id, m);
    return map;
  }, [visibleMessages]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // AUDIO RECORDING + FILE UPLOAD
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const handleAudioSend = useCallback(async () => {
    const result = await audioRecorder.stopRecording();
    if (!result) return;
    setUploading(true);
    const ext = result.file.name.split('.').pop() || 'webm';
    const fileName = `${currentUserId}/${conversationId}/${Date.now()}_voice.${ext}`;
    const { error } = await supabase.storage.from('chat-media').upload(fileName, result.file, { cacheControl: '3600', upsert: false });
    if (error) { toast.error('Error al subir audio'); setUploading(false); return; }
    const { data: signedData } = await supabase.storage.from('chat-media').createSignedUrl(fileName, CHAT_CONFIG.SIGNED_URL_EXPIRY);
    if (signedData?.signedUrl) { onSendMessage('', signedData.signedUrl, 'audio'); toast.success(`Audio ${formatAudioDuration(result.duration)} enviado`); }
    setUploading(false);
  }, [audioRecorder, currentUserId, conversationId, onSendMessage]);

  const uploadFile = useCallback(async (file: File): Promise<{ url: string; type: string } | null> => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) return null;
    if (file.size > CHAT_CONFIG.MAX_FILE_SIZE) return null;
    let fileToUpload = file;
    if (isImage) { try { fileToUpload = await compressImage(file); } catch { fileToUpload = file; } }
    const ext = fileToUpload.name.split('.').pop() || 'bin';
    const fileName = `${currentUserId}/${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('chat-media').upload(fileName, fileToUpload, { cacheControl: '3600', upsert: false });
    if (error) { console.error('Upload error:', error); return null; }
    const { data: signedData } = await supabase.storage.from('chat-media').createSignedUrl(fileName, CHAT_CONFIG.SIGNED_URL_EXPIRY);
    if (!signedData?.signedUrl) return null;
    return { url: signedData.signedUrl, type: isImage ? 'image' : 'video' };
  }, [currentUserId, conversationId]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    if (files.length > CHAT_CONFIG.MAX_BATCH_FILES) { toast.error(`Maximo ${CHAT_CONFIG.MAX_BATCH_FILES} archivos a la vez`); return; }
    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { toast.error(`${file.name}: Solo imagenes y videos`); continue; }
      if (file.size > CHAT_CONFIG.MAX_FILE_SIZE) { toast.error(`${file.name}: Max 10MB`); continue; }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;
    setUploading(true);
    setUploadProgress({ current: 0, total: validFiles.length });
    let successCount = 0; let failCount = 0;
    for (let i = 0; i < validFiles.length; i++) {
      setUploadProgress({ current: i + 1, total: validFiles.length });
      const result = await uploadFile(validFiles[i]);
      if (result) { onSendMessage('', result.url, result.type, replyingTo?.id); successCount++; }
      else failCount++;
      if (i < validFiles.length - 1) await new Promise(r => setTimeout(r, 200));
    }
    setUploading(false); setUploadProgress({ current: 0, total: 0 });
    if (replyingTo) setReplyingTo(null);
    if (successCount > 0) toast.success(`${successCount} archivo${successCount > 1 ? 's' : ''} enviado${successCount > 1 ? 's' : ''}`);
    if (failCount > 0) toast.error(`${failCount} archivo${failCount > 1 ? 's' : ''} fallaron`);
  }, [uploadFile, onSendMessage, replyingTo]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SEND TEXT / SAVE EDIT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const handleSend = useCallback(() => {
    // If editing, save edit instead
    if (editingMessage && onSaveEdit) {
      onSaveEdit(editText);
      return;
    }
    const now = Date.now();
    if (now - lastSendRef.current < CHAT_CONFIG.RATE_LIMIT_MS) return;
    lastSendRef.current = now;
    const text = inputText.trim();
    if (!text || isBlocked || uploading) return;
    onSendMessage(text, undefined, undefined, replyingTo?.id || undefined);
    setInputText(''); setReplyingTo(null); sendStopTyping(); setShowEmojiPicker(false);
    inputRef.current?.focus();
  }, [inputText, isBlocked, uploading, onSendMessage, replyingTo, sendStopTyping, editingMessage, onSaveEdit, editText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') {
      if (editingMessage && onCancelEdit) onCancelEdit();
      else if (replyingTo) setReplyingTo(null);
      if (showEmojiPicker) setShowEmojiPicker(false);
    }
  }, [handleSend, replyingTo, showEmojiPicker, editingMessage, onCancelEdit]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    if (editingMessage) setEditText(prev => prev + emoji);
    else setInputText(prev => prev + emoji);
    inputRef.current?.focus();
  }, [editingMessage]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CONTEXT MENU HANDLERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const handleContextMenu = useCallback((e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    setContextMenu({ msgId, x: e.clientX, y: e.clientY });
  }, []);

  const handleReply = useCallback((msgId: string) => {
    const msg = messageMap.get(msgId);
    if (msg) setReplyingTo(msg);
    setContextMenu(null);
  }, [messageMap]);

  const handleForward = useCallback((msgId: string) => {
    const msg = messageMap.get(msgId);
    if (msg) onForward(msg);
    setContextMenu(null);
  }, [messageMap, onForward]);

  const handleDeleteMsg = useCallback((msgId: string) => {
    if (onDeleteMessage) onDeleteMessage(msgId);
    setContextMenu(null);
  }, [onDeleteMessage]);

  const handleBulkDeleteAction = useCallback(() => {
    if (onBulkDelete && bulkSelect.selectedIds.size > 0) onBulkDelete(bulkSelect.selectedIds);
  }, [onBulkDelete, bulkSelect]);

  const handleBulkForward = useCallback(() => {
    const firstId = Array.from(bulkSelect.selectedIds)[0];
    const msg = messageMap.get(firstId);
    if (msg) onForward(msg);
    bulkSelect.stopSelecting();
  }, [bulkSelect, messageMap, onForward]);

  const handleBulkCopy = useCallback(() => {
    const texts = Array.from(bulkSelect.selectedIds).map(id => messageMap.get(id)?.content).filter((t): t is string => Boolean(t)).join('\n');
    navigator.clipboard.writeText(texts).then(() => toast.success('Copiado'));
    bulkSelect.stopSelecting();
  }, [bulkSelect, messageMap]);

  const groupedMessages = groupMessagesByDate(visibleMessages);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  return (
    <div className="mensajes-main" style={{ position: 'relative', ...(wallpaper ? { background: wallpaper } : {}) }}>

      {/* Active Call Overlay */}
      {activeCall?.active && activeCall.peerId === otherUser.id && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: activeCall.type === 'video' ? '#000' : 'linear-gradient(135deg, #0a0a0f 0%, #12071a 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {activeCall.type === 'video' && (
            <div style={{ textAlign: 'center', zIndex: 2, color: 'white' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{otherUser.fullName}</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                {activeCall.status === 'calling' && 'ðŸ“ž Llamando...'}
                {activeCall.status === 'ringing' && 'ðŸ”” Sonando...'}
                {activeCall.status === 'connected' && `â±ï¸ ${formatCallDuration(activeCall.duration)}`}
              </div>
            </div>
          )}
          {activeCall.type === 'audio' && (
            <div style={{ textAlign: 'center', zIndex: 2 }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(29,78,216,0.1)', border: '1px solid rgba(29,78,216,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '36px', fontWeight: 700, overflow: 'hidden', color: 'var(--mc-blue)' }}>
                {otherUser.avatarUrl ? <img src={otherUser.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(otherUser.fullName)}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{otherUser.fullName}</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                {activeCall.status === 'calling' && 'Llamando...'}
                {activeCall.status === 'ringing' && 'Sonando...'}
                {activeCall.status === 'connected' && formatCallDuration(activeCall.duration)}
              </div>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '16px', zIndex: 3, background: 'rgba(0,0,0,0.4)', borderRadius: '40px', padding: '10px 20px' }}>
            <button onClick={toggleMute} title={activeCall.isMuted ? 'Activar mic' : 'Silenciar'} style={{ width: '52px', height: '52px', borderRadius: '50%', background: activeCall.isMuted ? '#ef4444' : 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeCall.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            {activeCall.type === 'video' && (
              <button onClick={toggleVideo} title={activeCall.isVideoOff ? 'Activar camara' : 'Apagar camara'} style={{ width: '52px', height: '52px', borderRadius: '50%', background: activeCall.isVideoOff ? '#ef4444' : 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {activeCall.isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
              </button>
            )}
            <button onClick={endActiveCall} title="Colgar" style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(239,68,68,0.4)' }}>
              <PhoneOff size={22} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mensajes-chat-header">
        <button className="mensajes-chat-header-back" onClick={onBack}><ArrowLeft size={20} /></button>
        <div className="mensajes-chat-header-avatar">
          {otherUser.avatarUrl ? <img src={otherUser.avatarUrl} alt="" /> : getInitials(otherUser.fullName)}
        </div>
        <div className="mensajes-chat-header-info">
          <div className="mensajes-chat-header-name">
            {otherUser.fullName}
            <EncryptionBadge isEncrypted={isEncrypted} />
          </div>
          <div className={`mensajes-chat-header-status ${!otherUser.isOnline ? 'offline' : ''}`}>
            {formatLastSeen(otherUser.lastSeen, otherUser.isOnline)}
            {disappearing.timer !== 'off' && (
              <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--mc-text-muted)' }}>
                <Timer size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />{disappearing.timer}
              </span>
            )}
          </div>
        </div>
        {/* v8 header buttons */}
        {onOpenSearch && (
          <button onClick={onOpenSearch} title="Buscar" style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px' }}><Search size={18} /></button>
        )}
        <button onClick={() => bulkSelect.isSelecting ? bulkSelect.stopSelecting() : bulkSelect.startSelecting()}
          title={bulkSelect.isSelecting ? 'Cancelar seleccion' : 'Seleccionar mensajes'}
          style={{ background: 'none', border: 'none', color: bulkSelect.isSelecting ? 'var(--mc-blue)' : 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px', marginLeft: '4px' }}>
          <CheckSquare size={18} />
        </button>
      </div>

      {/* Floating Action Panel */}
      <div className={`chat-action-panel ${showActions ? 'open' : ''}`}>
        <button className="chat-action-toggle" onClick={() => setShowActions(!showActions)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {showActions ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 18l6-6-6-6"/>}
          </svg>
        </button>
        {showActions && (
          <div className="chat-action-buttons">
            {!isBlocked && (
              <>
                <button onClick={() => { startCall('audio'); setShowActions(false); }} title="Llamada de voz"><Phone size={18} /></button>
                <button onClick={() => { startCall('video'); setShowActions(false); }} title="Videollamada"><Video size={18} /></button>
                <button onClick={() => { setShowTimerPicker(true); setShowActions(false); }} title="Mensajes temporales"><Timer size={18} /></button>
              </>
            )}
            {/* v8 action buttons */}
            {onOpenMedia && (
              <button onClick={() => { onOpenMedia(); setShowActions(false); }} title="Media compartida"><ImageIcon size={18} /></button>
            )}
            <div style={{ position: 'relative' }} ref={settingsRef}>
              <button onClick={() => setShowSettings(!showSettings)} title="Opciones"><MoreVertical size={18} /></button>
              {showSettings && (
                <div className="chat-action-settings-menu">
                  <button onClick={() => { onMute(); setShowSettings(false); setShowActions(false); }}><VolumeX size={14} />{isMuted ? 'Activar' : 'Silenciar'}</button>
                  {onArchive && <button onClick={() => { onArchive(); setShowSettings(false); setShowActions(false); }}><Archive size={14} />{isArchived ? 'Desarchivar' : 'Archivar'}</button>}
                  {onExport && (
                    <button onClick={() => { onExport('txt'); setShowSettings(false); setShowActions(false); }}><Download size={14} />Exportar chat</button>
                  )}
                  <button className="danger" onClick={() => { onBlock(); setShowSettings(false); setShowActions(false); }}><Ban size={14} />{isBlocked ? 'Desbloquear' : 'Bloquear'}</button>
                  <button className="danger" onClick={() => { onReport(); setShowSettings(false); setShowActions(false); }}><Flag size={14} />Reportar</button>
                  <button className="danger" onClick={() => { onDelete(); setShowSettings(false); setShowActions(false); }}><Trash2 size={14} />Eliminar</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DisappearingTimerPicker open={showTimerPicker} currentTimer={disappearing.timer} onChange={(t: DisappearTimer) => disappearing.setTimer(t)} onClose={() => setShowTimerPicker(false)} />

      {/* Messages */}
      <div className="mensajes-messages">
        {visibleMessages.length === 0 ? (
          <div className="mensajes-empty-state"><p>EnvÃ­a un mensaje para iniciar la conversacion</p></div>
        ) : (
          Array.from(groupedMessages.entries()).map(([dateKey, msgs]) => (
            <React.Fragment key={dateKey}>
              <div className="mensajes-date-divider"><span>{formatDate(msgs[0].createdAt)}</span></div>
              {msgs.map((msg) => {
                const isSent = msg.senderId === currentUserId;
                const repliedMsg = msg.replyTo ? messageMap.get(msg.replyTo) : null;
                const isSelected = bulkSelect.selectedIds.has(msg.id);
                const msgReactions = reactions?.[msg.id] || [];
                const isStarred = starredMessages?.isStarred(msg.id);
                const msgDeliveryStatus = isSent && deliveryStatus ? deliveryStatus.getStatus(msg.id, msg.isRead) : undefined;
                const urlInContent = linkPreview?.extractUrl(msg.content);

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`mensajes-msg ${isSent ? 'sent' : 'received'} ${isSelected ? 'selected' : ''}`}
                    onContextMenu={(e) => handleContextMenu(e, msg.id)}
                    onMouseEnter={() => setHoveredMsgId(msg.id)}
                    onMouseLeave={() => setHoveredMsgId(null)}
                    onClick={bulkSelect.isSelecting ? () => bulkSelect.toggleSelect(msg.id) : undefined}
                    style={{ position: 'relative', cursor: bulkSelect.isSelecting ? 'pointer' : undefined, outline: isSelected ? '2px solid var(--mc-blue)' : undefined, borderRadius: '2px', transition: 'background 0.3s' }}
                  >
                    {bulkSelect.isSelecting && (
                      <div style={{ position: 'absolute', top: '4px', [isSent ? 'left' : 'right']: '-28px', width: '20px', height: '20px', borderRadius: '2px', border: `2px solid ${isSelected ? 'var(--mc-blue)' : 'var(--mc-border)'}`, background: isSelected ? 'var(--mc-blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <Check size={12} style={{ color: '#0a0a0f' }} />}
                      </div>
                    )}

                    {msg.isForwarded && (
                      <div style={{ fontSize: '11px', color: 'var(--mc-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', fontStyle: 'italic', paddingLeft: '4px' }}>
                        <CornerUpRight size={12} /> Reenviado
                      </div>
                    )}

                    {repliedMsg && (
                      <div style={{ background: isSent ? 'rgba(29,78,216,0.08)' : 'rgba(255,255,255,0.03)', borderLeft: '2px solid var(--mc-blue)', borderRadius: '0', padding: '6px 10px', marginBottom: '4px', fontSize: '12px', maxWidth: '100%', cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); const el = document.getElementById(`msg-${repliedMsg.id}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.classList.add('msg-highlight'); setTimeout(() => el?.classList.remove('msg-highlight'), 1500); }}>
                        <div style={{ fontWeight: 600, color: 'var(--mc-blue)', marginBottom: '2px' }}>{repliedMsg.senderId === currentUserId ? 'TÃº' : otherUser.fullName}</div>
                        <div style={{ color: 'var(--mc-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{repliedMsg.mediaUrl ? 'ðŸ“Ž Archivo' : truncateText(repliedMsg.content, 60)}</div>
                      </div>
                    )}

                    {msg.mediaUrl && (
                      <div className="mensajes-msg-media">
                        {msg.mediaType === 'image' ? <img src={msg.mediaUrl} alt="Media" loading="lazy" onClick={(e) => { e.stopPropagation(); setLightboxSrc(msg.mediaUrl); }} style={{ cursor: 'zoom-in' }} />
                          : msg.mediaType === 'video' ? <video src={msg.mediaUrl} controls preload="metadata" />
                          : msg.mediaType === 'audio' ? <audio src={msg.mediaUrl} controls preload="metadata" style={{ maxWidth: '240px' }} /> : null}
                      </div>
                    )}

                    {msg.content && (
                      msg.iv ? (
                        <DecryptedBubble msg={msg} currentUserId={currentUserId} otherUserId={otherUser.id} e2ee={e2ee} />
                      ) : (
                        <div className="mensajes-msg-bubble">{msg.content}</div>
                      )
                    )}

                    {/* v8: Link Preview */}
                    {urlInContent && linkPreview && (
                      <LinkPreviewCard
                        url={urlInContent}
                        preview={linkPreview.previews.get(urlInContent) ?? null}
                        onFetch={linkPreview.fetchPreview}
                      />
                    )}

                    {/* v8: Reactions */}
                    {msgReactions.length > 0 && onToggleReaction && (
                      <ReactionBadge reactions={msgReactions} onToggle={(emoji) => onToggleReaction(msg.id, emoji)} />
                    )}

                    <div className="mensajes-msg-meta">
                      {isStarred && <Star size={10} style={{ color: '#fbbf24', fill: '#fbbf24', marginRight: '2px' }} />}
                      {msg.editedAt && <span style={{ fontSize: '10px', color: 'var(--mc-text-muted)', marginRight: '4px' }}>editado</span>}
                      {msg.expiresAt && <Timer size={10} style={{ color: 'var(--mc-text-muted)', marginRight: '2px' }} />}
                      <span className="mensajes-msg-time">{formatMessageTime(msg.createdAt)}</span>
                      {isSent && (
                        msgDeliveryStatus ? (
                          <MessageStatusIcon status={msgDeliveryStatus} size={14} />
                        ) : (
                          <span className={`mensajes-msg-status ${msg.isRead ? 'read' : ''}`}>
                            {msg.isRead ? <CheckCheck size={14} /> : <Check size={14} />}
                          </span>
                        )
                      )}
                    </div>

                    {/* Hover action buttons */}
                    {hoveredMsgId === msg.id && !bulkSelect.isSelecting && (
                      <div style={{ position: 'absolute', top: '0', [isSent ? 'left' : 'right']: '-130px', display: 'flex', gap: '2px', background: 'var(--mc-sidebar)', borderRadius: '0', padding: '2px', border: '1px solid var(--mc-border)', zIndex: 10 }}>
                        <button onClick={() => handleReply(msg.id)} title="Responder" style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px', display: 'flex' }}><Reply size={14} /></button>
                        <button onClick={() => handleForward(msg.id)} title="Reenviar" style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px', display: 'flex' }}><Forward size={14} /></button>
                        {/* v8: Reaction trigger */}
                        {onToggleReaction && (
                          <button onClick={(e) => { e.stopPropagation(); setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id); }} title="Reaccionar" style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px', display: 'flex' }}><SmilePlus size={14} /></button>
                        )}
                        {/* v8: Pin */}
                        {onPinMessage && (
                          <button onClick={() => { onPinMessage(msg.id, msg.content); setHoveredMsgId(null); }} title="Fijar" style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px', display: 'flex' }}><Pin size={14} /></button>
                        )}
                        {/* v8: Star */}
                        {onToggleStar && (
                          <button onClick={() => onToggleStar(msg.id, msg.content)} title={isStarred ? 'Desmarcar' : 'Destacar'} style={{ background: 'none', border: 'none', color: isStarred ? '#fbbf24' : 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px', display: 'flex' }}><Star size={14} fill={isStarred ? '#fbbf24' : 'none'} /></button>
                        )}
                        {/* v8: Edit (own messages only) */}
                        {isSent && onStartEdit && canEditMessage?.(msg.senderId, msg.createdAt) && (
                          <button onClick={() => onStartEdit(msg.id, msg.content)} title="Editar" style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px', display: 'flex' }}><Edit3 size={14} /></button>
                        )}
                        {isSent && onDeleteMessage && (
                          <button onClick={() => handleDeleteMsg(msg.id)} title="Eliminar" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', display: 'flex' }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    )}

                    {/* v8: Reaction Picker popup */}
                    {showReactionPicker === msg.id && onToggleReaction && (
                      <div style={{ position: 'absolute', top: '-48px', [isSent ? 'right' : 'left']: '0', zIndex: 20 }} onMouseDown={(e) => e.stopPropagation()}>
                        <ReactionPicker onSelect={(emoji) => { onToggleReaction(msg.id, emoji); setShowReactionPicker(null); }} position="above" />
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))
        )}
        {isOtherTyping && <TypingIndicator userName={otherUser.fullName} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: 'var(--mc-sidebar)', border: '1px solid var(--mc-border)', borderRadius: '0', padding: '4px', zIndex: 60, minWidth: '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          <button className="mensajes-settings-item" onClick={() => handleReply(contextMenu.msgId)}><Reply size={16} /> Responder</button>
          <button className="mensajes-settings-item" onClick={() => handleForward(contextMenu.msgId)}><Forward size={16} /> Reenviar</button>
          {onToggleStar && (
            <button className="mensajes-settings-item" onClick={() => { const msg = messageMap.get(contextMenu.msgId); if (msg) onToggleStar(msg.id, msg.content); setContextMenu(null); }}><Star size={16} /> {starredMessages?.isStarred(contextMenu.msgId) ? 'Desmarcar' : 'Destacar'}</button>
          )}
          {onPinMessage && (
            <button className="mensajes-settings-item" onClick={() => { const msg = messageMap.get(contextMenu.msgId); if (msg) onPinMessage(msg.id, msg.content); setContextMenu(null); }}><Pin size={16} /> Fijar</button>
          )}
          {(() => { const msg = messageMap.get(contextMenu.msgId); return msg && msg.senderId === currentUserId && onStartEdit && canEditMessage?.(msg.senderId, msg.createdAt); })() && (
            <button className="mensajes-settings-item" onClick={() => { const msg = messageMap.get(contextMenu.msgId); if (msg && onStartEdit) onStartEdit(msg.id, msg.content); setContextMenu(null); }}><Edit3 size={16} /> Editar</button>
          )}
          {threadReplies && (
            <button className="mensajes-settings-item" onClick={() => { const msg = messageMap.get(contextMenu.msgId); if (msg) threadReplies.openThread(msg.id, msg.content, msg.senderId === currentUserId ? currentUserName : otherUser.fullName, 'private_messages'); setContextMenu(null); }}><Reply size={16} /> Ver hilo</button>
          )}
          {onDeleteMessage && (
            <button className="mensajes-settings-item" style={{ color: '#ef4444' }} onClick={() => handleDeleteMsg(contextMenu.msgId)}><Trash2 size={16} /> Eliminar</button>
          )}
        </div>
      )}

      {bulkSelect.isSelecting && (
        <BulkActionBar selectedCount={bulkSelect.selectedCount} onDelete={handleBulkDeleteAction} onForward={handleBulkForward} onCopy={handleBulkCopy} onCancel={() => bulkSelect.stopSelecting()} />
      )}

      {isBlocked && (
        <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.06)', borderTop: '1px solid rgba(239,68,68,0.1)', textAlign: 'center', color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Ban size={16} /> Has bloqueado a este usuario.
          <button onClick={onBlock} style={{ background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}>Desbloquear</button>
        </div>
      )}

      {uploading && (
        <div style={{ padding: '8px 20px', background: 'rgba(29,78,216,0.06)', borderTop: '1px solid rgba(29,78,216,0.1)', textAlign: 'center', color: 'var(--mc-blue)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid var(--mc-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Subiendo {uploadProgress.current}/{uploadProgress.total} archivos...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Edit Bar */}
      {editingMessage && onCancelEdit && (
        <div style={{ padding: '8px 20px', background: 'rgba(59,130,246,0.06)', borderTop: '1px solid rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Edit3 size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>Editando mensaje</div>
            <div style={{ fontSize: '13px', color: 'var(--mc-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{truncateText(editingMessage.originalContent, 60)}</div>
          </div>
          <button onClick={onCancelEdit} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '4px' }}><X size={16} /></button>
        </div>
      )}

      {/* Reply Bar */}
      {replyingTo && !isBlocked && !editingMessage && (
        <div style={{ padding: '8px 20px', background: 'var(--mc-sidebar)', borderTop: '1px solid var(--mc-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '2px', height: '36px', background: 'var(--mc-blue)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mc-blue)' }}>{replyingTo.senderId === currentUserId ? 'TÃº' : otherUser.fullName}</div>
            <div style={{ fontSize: '13px', color: 'var(--mc-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyingTo.mediaUrl ? 'ðŸ“Ž Archivo' : truncateText(replyingTo.content, 80)}</div>
          </div>
          <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '4px' }}><X size={16} /></button>
        </div>
      )}

      {/* Input */}
      {!isBlocked && !bulkSelect.isSelecting && (
        <div className="mensajes-input-area" style={{ position: 'relative' }}>
          {showEmojiPicker && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}

          <div className="mensajes-input-actions">
            <button className="mensajes-input-btn" title="Emoji" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              style={showEmojiPicker ? { color: 'var(--mc-blue)' } : {}}>
              <Smile size={20} />
            </button>
            {!editingMessage && (
              <button className="mensajes-input-btn" title="Adjuntar" onClick={() => fileInputRef.current?.click()} disabled={uploading || audioRecorder.isRecording}
                style={uploading || audioRecorder.isRecording ? { opacity: 0.4, cursor: 'not-allowed' } : {}}>
                <Paperclip size={20} />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" style={{ display: 'none' }} onChange={handleFileSelect} multiple />
          </div>

          {audioRecorder.isRecording ? (
            <div style={{ flex: 1 }}>
              <AudioRecorderButton isRecording={audioRecorder.isRecording} duration={audioRecorder.duration} isSupported={audioRecorder.isSupported}
                onStart={() => audioRecorder.startRecording()} onStop={handleAudioSend} onCancel={() => audioRecorder.cancelRecording()} />
            </div>
          ) : (
            <>
              <div className="mensajes-input-wrapper">
                <textarea ref={inputRef} className="mensajes-input-field mensajes-input-text"
                  placeholder={editingMessage ? 'Edita tu mensaje...' : replyingTo ? 'Escribe tu respuesta...' : 'Escribe un mensaje...'}
                  value={editingMessage ? editText : inputText}
                  onChange={(e) => { if (editingMessage) setEditText(e.target.value); else { setInputText(e.target.value); sendTyping(); } }}
                  onKeyDown={handleKeyDown} rows={1} disabled={uploading}
                  maxLength={CHAT_CONFIG.MAX_MESSAGE_LENGTH} />
              </div>
              {(editingMessage ? editText.trim() : inputText.trim()) ? (
                <button className="mensajes-send-btn" onClick={handleSend} disabled={uploading} title={editingMessage ? 'Guardar' : 'Enviar'}>
                  {editingMessage ? <Check size={18} /> : <Send size={18} />}
                </button>
              ) : !editingMessage ? (
                <AudioRecorderButton isRecording={false} duration={0} isSupported={audioRecorder.isSupported}
                  onStart={() => audioRecorder.startRecording()} onStop={handleAudioSend} onCancel={() => audioRecorder.cancelRecording()} />
              ) : null}
            </>
          )}
        </div>
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
};

export default ChatWindow;