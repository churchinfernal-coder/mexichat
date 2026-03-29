

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Send, Smile, Paperclip, MoreVertical,
  UserPlus, LogOut, Trash2, Settings, Crown,
  Shield, Users, Camera, Edit3, Pin, Star,
  Search, Image as ImageIcon, Download, Archive,
  SmilePlus, Link2, BellOff, Check, X,
  Reply, Forward,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import EmojiPicker from '@/components/chat/EmojiPicker';
import AudioRecorderButton from '@/components/chat/AudioRecorderButton';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { compressImage } from '@/utils/imageCompression';
import { formatAudioDuration } from '@/utils/audioEncoder';
import { CHAT_CONFIG } from '@/config/chat';

// v8 components
import ReactionPicker from '@/components/chat/ReactionPicker';
import ReactionBadge from '@/components/chat/ReactionBadge';
import MentionAutocomplete from '@/components/chat/MentionAutocomplete';
import LinkPreviewCard from '@/components/chat/LinkPreviewCard';

// v8 types
import type { Reaction, MessageReactions } from '@/hooks/useMessageReactions';
import type { EditState } from '@/hooks/useMessageEdit';
import type { PinnedMessage } from '@/hooks/usePinnedMessages';
import type { MentionSuggestion } from '@/hooks/useMentions';
import type { PendingJoinRequest } from '@/hooks/useGroupInvites';
import type { MuteDuration } from '@/hooks/useGroupMute';
import type { LinkPreviewData } from '@/hooks/useLinkPreview';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
  editedAt?: string | null;
}

export interface GroupMember {
  userId: string;
  fullName: string;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  isOnline: boolean;
  role: 'owner' | 'admin' | 'member';
}

export interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  inviteCode: string | null;
  createdBy: string;
}

interface GroupChatWindowProps {
  currentUserId: string;
  group: GroupInfo;
  members: GroupMember[];
  messages: GroupMessage[];
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string) => void;
  onBack: () => void;
  onAddMember: () => void;
  onRemoveMember: (userId: string) => void;
  onPromoteMember: (userId: string, role: 'admin' | 'member') => void;
  onLeaveGroup: () => void;
  onDeleteGroup: () => void;
  onEditGroup: (name: string, description: string) => void;
  onEditGroupAvatar?: (avatarUrl: string) => void;
  myRole: 'owner' | 'admin' | 'member';
  // â”€â”€ v8 props â”€â”€
  onOpenInvite?: () => void;
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
  mentions?: {
    suggestions: MentionSuggestion[];
    showSuggestions: boolean;
    mentionQuery: string;
    checkForMention: (text: string, cursorPos: number) => void;
    applyMention: (text: string, cursorPos: number, suggestion: MentionSuggestion) => { newText: string; newCursor: number };
    extractMentions: (text: string) => string[];
    closeSuggestions: () => void;
  };
  joinRequests?: PendingJoinRequest[];
  onApproveJoin?: (requestId: string, userId: string, groupId: string) => Promise<void>;
  onRejectJoin?: (requestId: string) => Promise<void>;
  starredMessages?: { isStarred: (messageId: string) => boolean };
  onToggleStar?: (messageId: string, content: string) => void;
  isGroupMuted?: boolean;
  onMuteGroup?: (duration: MuteDuration) => void;
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

function formatTime(dateStr: string): string {
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

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

function groupByDate(messages: GroupMessage[]): Map<string, GroupMessage[]> {
  const groups = new Map<string, GroupMessage[]>();
  for (const msg of messages) {
    const key = new Date(msg.createdAt).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(msg);
  }
  return groups;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MENTION-HIGHLIGHTED TEXT RENDERER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const MentionText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} style={{ color: 'var(--mc-blue)', fontWeight: 600 }}>{part}</span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AVATAR UPLOAD UTILITY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function uploadGroupAvatar(file: File, groupId: string): Promise<string | null> {
  if (!file.type.startsWith('image/')) { toast.error('Solo se permiten imagenes'); return null; }
  if (file.size > 5 * 1024 * 1024) { toast.error('Imagen demasiado grande (max 5MB)'); return null; }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `groups/${groupId}/${Date.now()}_avatar.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
  if (error) {
    const { error: fallbackErr } = await supabase.storage.from('chat-media').upload(fileName, file, { upsert: true });
    if (fallbackErr) { toast.error('Error al subir imagen'); return null; }
    const { data } = supabase.storage.from('chat-media').getPublicUrl(fileName);
    return data.publicUrl;
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return data.publicUrl;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const GroupChatWindow: React.FC<GroupChatWindowProps> = ({
  currentUserId,
  group,
  members,
  messages,
  onSendMessage,
  onBack,
  onAddMember,
  onRemoveMember,
  onPromoteMember,
  onLeaveGroup,
  onDeleteGroup,
  onEditGroup,
  onEditGroupAvatar,
  myRole,
  // v8 props
  onOpenInvite,
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
  mentions,
  joinRequests,
  onApproveJoin,
  onRejectJoin,
  starredMessages,
  onToggleStar,
  isGroupMuted,
  onMuteGroup,
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
  const [showMembers, setShowMembers] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editDesc, setEditDesc] = useState(group.description || '');
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(group.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);

  // v8 local state
  const [editText, setEditText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const audioRecorder = useAudioRecorder();

  // Restore draft
  useEffect(() => {
    if (draft && !inputText) setInputText(draft);
  }, [group.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync edit text
  useEffect(() => {
    if (editingMessage) { setEditText(editingMessage.originalContent); inputRef.current?.focus(); }
    else setEditText('');
  }, [editingMessage]);

  // Reset edit fields when group changes
  useEffect(() => {
    setEditName(group.name);
    setEditDesc(group.description || '');
    setEditAvatarPreview(group.avatarUrl);
  }, [group.name, group.description, group.avatarUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    };
    if (showSettings) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSettings]);

  useEffect(() => {
    const handleClick = () => { setContextMenu(null); setShowReactionPicker(null); };
    if (contextMenu || showReactionPicker) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu, showReactionPicker]);

  // Reset mention index when suggestions change
  useEffect(() => { setMentionActiveIdx(0); }, [mentions?.suggestions]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SEND / EDIT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const handleSend = useCallback(() => {
    // If editing, save edit instead
    if (editingMessage && onSaveEdit) {
      onSaveEdit(editText);
      return;
    }
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text);
    setInputText('');
    setShowEmojiPicker(false);
    mentions?.closeSuggestions();
    inputRef.current?.focus();
  }, [inputText, onSendMessage, editingMessage, onSaveEdit, editText, mentions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Mention navigation
    if (mentions?.showSuggestions && mentions.suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActiveIdx(prev => (prev + 1) % mentions.suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActiveIdx(prev => (prev - 1 + mentions.suggestions.length) % mentions.suggestions.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const suggestion = mentions.suggestions[mentionActiveIdx];
        if (suggestion && inputRef.current) {
          const cursorPos = inputRef.current.selectionStart ?? inputText.length;
          const { newText, newCursor } = mentions.applyMention(inputText, cursorPos, suggestion);
          setInputText(newText);
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.selectionStart = newCursor;
              inputRef.current.selectionEnd = newCursor;
            }
          });
        }
        return;
      }
      if (e.key === 'Escape') { mentions.closeSuggestions(); return; }
    }

    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') {
      if (editingMessage && onCancelEdit) onCancelEdit();
      if (showEmojiPicker) setShowEmojiPicker(false);
    }
  }, [handleSend, showEmojiPicker, mentions, mentionActiveIdx, inputText, editingMessage, onCancelEdit]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (editingMessage) {
      setEditText(val);
    } else {
      setInputText(val);
      // Check for @mentions
      if (mentions) {
        const cursorPos = e.target.selectionStart ?? val.length;
        mentions.checkForMention(val, cursorPos);
      }
    }
  }, [editingMessage, mentions]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    if (editingMessage) setEditText(prev => prev + emoji);
    else setInputText(prev => prev + emoji);
    inputRef.current?.focus();
  }, [editingMessage]);

  const handleMentionSelect = useCallback((suggestion: MentionSuggestion) => {
    if (!mentions || !inputRef.current) return;
    const cursorPos = inputRef.current.selectionStart ?? inputText.length;
    const { newText, newCursor } = mentions.applyMention(inputText, cursorPos, suggestion);
    setInputText(newText);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.selectionStart = newCursor;
        inputRef.current.selectionEnd = newCursor;
        inputRef.current.focus();
      }
    });
  }, [mentions, inputText]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CONTEXT MENU
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const handleContextMenu = useCallback((e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    setContextMenu({ msgId, x: e.clientX, y: e.clientY });
  }, []);

  const messageMap = React.useMemo(() => {
    const map = new Map<string, GroupMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // GROUP AVATAR UPLOAD
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const handleGroupAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarUploading(true);
    try {
      const url = await uploadGroupAvatar(file, group.id);
      if (url) {
        setEditAvatarPreview(url);
        if (onEditGroupAvatar) onEditGroupAvatar(url);
        else await supabase.from('groups').update({ avatar_url: url } as any).eq('id', group.id);
        toast.success('Avatar de grupo actualizado');
      }
    } finally { setAvatarUploading(false); }
  }, [group.id, onEditGroupAvatar]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FILE UPLOAD
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    let successCount = 0; let failCount = 0;
    for (const file of files.slice(0, CHAT_CONFIG.MAX_BATCH_FILES)) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) { toast.error(`${file.name}: Solo imagenes y videos`); failCount++; continue; }
      if (file.size > CHAT_CONFIG.MAX_FILE_SIZE) { toast.error(`${file.name}: Max 10MB`); failCount++; continue; }
      let fileToUpload = file;
      if (isImage) { try { fileToUpload = await compressImage(file); } catch { fileToUpload = file; } }
      const ext = fileToUpload.name.split('.').pop() || 'bin';
      const fileName = `groups/${group.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('chat-media').upload(fileName, fileToUpload, { cacheControl: '3600', upsert: false });
      if (error) { failCount++; continue; }
      const { data: signedData } = await supabase.storage.from('chat-media').createSignedUrl(fileName, CHAT_CONFIG.SIGNED_URL_EXPIRY);
      if (signedData?.signedUrl) { onSendMessage('', signedData.signedUrl, isImage ? 'image' : 'video'); successCount++; }
      else failCount++;
    }
    setUploading(false);
    if (successCount > 0) toast.success(`${successCount} archivo${successCount > 1 ? 's' : ''} enviado${successCount > 1 ? 's' : ''}`);
    if (failCount > 0) toast.error(`${failCount} archivo${failCount > 1 ? 's' : ''} fallaron`);
  }, [onSendMessage, group.id]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•ï¿½ï¿½ï¿½â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // AUDIO SEND
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const handleAudioSend = useCallback(async () => {
    const result = await audioRecorder.stopRecording();
    if (!result) return;
    setUploading(true);
    const ext = result.file.name.split('.').pop() || 'webm';
    const fileName = `groups/${group.id}/${Date.now()}_voice.${ext}`;
    const { error } = await supabase.storage.from('chat-media').upload(fileName, result.file, { cacheControl: '3600', upsert: false });
    if (error) { toast.error('Error al subir audio'); setUploading(false); return; }
    const { data: signedData } = await supabase.storage.from('chat-media').createSignedUrl(fileName, CHAT_CONFIG.SIGNED_URL_EXPIRY);
    if (signedData?.signedUrl) { onSendMessage('', signedData.signedUrl, 'audio'); toast.success(`Audio ${formatAudioDuration(result.duration)} enviado`); }
    setUploading(false);
  }, [audioRecorder, group.id, onSendMessage]);

  const handleSaveGroupEdit = useCallback(() => {
    if (!editName.trim()) { toast.error('El nombre es requerido'); return; }
    onEditGroup(editName.trim(), editDesc.trim());
    setShowEditGroup(false);
    toast.success('Grupo actualizado');
  }, [editName, editDesc, onEditGroup]);

  const onlineCount = members.filter(m => m.isOnline).length;
  const grouped = groupByDate(messages);
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  return (
    <div className="mensajes-main" style={wallpaper ? { background: wallpaper } : undefined}>

      {/* â”€â”€â”€ Header â”€â”€â”€ */}
      <div className="mensajes-chat-header">
        <button className="mensajes-chat-header-back" onClick={onBack}><ArrowLeft size={20} /></button>

        <div className="mensajes-chat-header-avatar" style={{ background: 'var(--mc-blue)', position: 'relative', overflow: 'hidden' }}>
          {group.avatarUrl ? <img src={group.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={18} style={{ color: 'white' }} />}
        </div>

        <div className="mensajes-chat-header-info" onClick={() => setShowMembers(true)} style={{ cursor: 'pointer' }}>
          <div className="mensajes-chat-header-name">
            {group.name}
            {isGroupMuted && <BellOff size={14} style={{ marginLeft: '6px', color: 'var(--mc-text-muted)', verticalAlign: 'middle' }} />}
          </div>
          <div className="mensajes-chat-header-status offline">
            {members.length} miembros · {onlineCount} en línea
          </div>
        </div>

        {/* v8 header buttons */}
        {onOpenSearch && (
          <button onClick={onOpenSearch} title="Buscar" style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px' }}><Search size={18} /></button>
        )}

        <div className="mensajes-chat-header-actions">
          <div style={{ position: 'relative' }} ref={settingsRef}>
            <button className="mensajes-chat-header-btn" onClick={() => setShowSettings(!showSettings)}><MoreVertical size={18} /></button>

            {showSettings && (
              <div className="mensajes-settings-menu">
                <button className="mensajes-settings-item" onClick={() => { setShowMembers(true); setShowSettings(false); }}>
                  <Users size={16} /> Ver miembros ({members.length})
                </button>
                {isAdmin && (
                  <button className="mensajes-settings-item" onClick={() => { onAddMember(); setShowSettings(false); }}>
                    <UserPlus size={16} /> Anadir miembro
                  </button>
                )}
                {isAdmin && (
                  <button className="mensajes-settings-item" onClick={() => { setShowEditGroup(true); setShowSettings(false); }}>
                    <Settings size={16} /> Editar grupo
                  </button>
                )}
                {/* v8: Invite link */}
                {isAdmin && onOpenInvite && (
                  <button className="mensajes-settings-item" onClick={() => { onOpenInvite(); setShowSettings(false); }}>
                    <Link2 size={16} /> Enlace de invitacion
                  </button>
                )}
                {/* v8: Shared media */}
                {onOpenMedia && (
                  <button className="mensajes-settings-item" onClick={() => { onOpenMedia(); setShowSettings(false); }}>
                    <ImageIcon size={16} /> Media compartida
                  </button>
                )}
                {/* v8: Mute group */}
                {onMuteGroup && (
                  <button className="mensajes-settings-item" onClick={() => { setShowMuteMenu(!showMuteMenu); }}>
                    <BellOff size={16} /> {isGroupMuted ? 'Desmutear grupo' : 'Silenciar grupo'}
                  </button>
                )}
                {showMuteMenu && onMuteGroup && (
                  <div style={{ paddingLeft: '24px' }}>
                    {isGroupMuted ? (
                      <button className="mensajes-settings-item" onClick={() => { onMuteGroup('off'); setShowMuteMenu(false); setShowSettings(false); }} style={{ fontSize: '12px' }}>Activar notificaciones</button>
                    ) : (
                      <>
                        <button className="mensajes-settings-item" onClick={() => { onMuteGroup('1h'); setShowMuteMenu(false); setShowSettings(false); }} style={{ fontSize: '12px' }}>1 hora</button>
                        <button className="mensajes-settings-item" onClick={() => { onMuteGroup('8h'); setShowMuteMenu(false); setShowSettings(false); }} style={{ fontSize: '12px' }}>8 horas</button>
                        <button className="mensajes-settings-item" onClick={() => { onMuteGroup('1w'); setShowMuteMenu(false); setShowSettings(false); }} style={{ fontSize: '12px' }}>1 semana</button>
                        <button className="mensajes-settings-item" onClick={() => { onMuteGroup('forever'); setShowMuteMenu(false); setShowSettings(false); }} style={{ fontSize: '12px' }}>Siempre</button>
                      </>
                    )}
                  </div>
                )}
                {/* v8: Archive */}
                {onArchive && (
                  <button className="mensajes-settings-item" onClick={() => { onArchive(); setShowSettings(false); }}>
                    <Archive size={16} /> {isArchived ? 'Desarchivar' : 'Archivar'}
                  </button>
                )}
                {/* v8: Export */}
                {onExport && (
                  <button className="mensajes-settings-item" onClick={() => { onExport('txt'); setShowSettings(false); }}>
                    <Download size={16} /> Exportar chat
                  </button>
                )}
                {/* Legacy invite code */}
                {group.inviteCode && !onOpenInvite && (
                  <button className="mensajes-settings-item" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/grupo/${group.inviteCode}`);
                    toast.success('Enlace copiado'); setShowSettings(false);
                  }}>
                    <Shield size={16} /> Copiar enlace de invitacion
                  </button>
                )}
                <button className="mensajes-settings-item danger" onClick={() => { onLeaveGroup(); setShowSettings(false); }}>
                  <LogOut size={16} /> Salir del grupo
                </button>
                {myRole === 'owner' && (
                  <button className="mensajes-settings-item danger" onClick={() => { onDeleteGroup(); setShowSettings(false); }}>
                    <Trash2 size={16} /> Eliminar grupo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€â”€ Members Panel â”€â”€â”€ */}
      {showMembers && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--mc-sidebar)', borderRadius: '12px', width: '100%', maxWidth: '400px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--mc-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--mc-text)' }}>Miembros ({members.length})</span>
              <button onClick={() => setShowMembers(false)} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer' }}>â�“•</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {members.map((m) => (
                <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--mc-sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                    {m.avatarUrl ? <img src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.fullName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--mc-text)' }}>{m.fullName}</span>
                      {m.role === 'owner' && <Crown size={14} style={{ color: 'var(--mc-blue)' }} />}
                      {m.role === 'admin' && <Shield size={14} style={{ color: '#3b82f6' }} />}
                    </div>
                    <div style={{ fontSize: '12px', color: m.isOnline ? 'var(--mc-online)' : 'var(--mc-text-muted)' }}>
                      {m.isOnline ? 'En línea' : m.username ? `@${m.username}` : 'Desconectado'}
                    </div>
                  </div>
                  {isAdmin && m.userId !== currentUserId && m.role !== 'owner' && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => onPromoteMember(m.userId, m.role === 'admin' ? 'member' : 'admin')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mc-text-muted)', padding: '4px' }}
                        title={m.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}><Shield size={14} /></button>
                      <button onClick={() => onRemoveMember(m.userId)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Expulsar"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€â”€ Edit Group Modal (with avatar upload) â”€â”€â”€ */}
      {showEditGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--mc-sidebar)', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '20px', border: '1px solid var(--mc-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--mc-text)' }}>Editar Grupo</span>
              <button onClick={() => setShowEditGroup(false)} style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer' }}>â�“•</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative', width: '72px', height: '72px' }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--mc-sidebar-active)', border: '2px solid var(--mc-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: 'var(--mc-text-muted)' }}>
                    {editAvatarPreview ? <img src={editAvatarPreview} alt="Avatar del grupo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={28} />}
                  </div>
                  <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                    style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '28px', height: '28px', borderRadius: '50%', background: 'var(--mc-blue)', border: '2px solid var(--mc-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: avatarUploading ? 'wait' : 'pointer', color: 'white' }} title="Cambiar foto de grupo">
                    {avatarUploading ? <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Camera size={12} />}
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} onChange={handleGroupAvatarChange} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--mc-text-muted)' }}>{editAvatarPreview ? 'Cambiar foto del grupo' : 'Agregar foto del grupo'}</span>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--mc-text-muted)', marginBottom: '4px', display: 'block' }}>Nombre del grupo</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--mc-border)', borderRadius: '8px', color: 'var(--mc-text)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--mc-text-muted)', marginBottom: '4px', display: 'block' }}>Descripcion</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--mc-border)', borderRadius: '8px', color: 'var(--mc-text)', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <button onClick={handleSaveGroupEdit} style={{ padding: '10px', background: 'var(--mc-blue)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Guardar cambios</button>
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* â”€â”€â”€ Messages â”€â”€â”€ */}
      <div className="mensajes-messages">
        {messages.length === 0 ? (
          <div className="mensajes-empty-state"><Users size={40} strokeWidth={1} /><p>Grupo creado. ¡Envía el primer mensaje!</p></div>
        ) : (
          Array.from(grouped.entries()).map(([dateKey, msgs]) => (
            <React.Fragment key={dateKey}>
              <div className="mensajes-date-divider"><span>{formatDate(msgs[0].createdAt)}</span></div>
              {msgs.map((msg) => {
                const isSent = msg.senderId === currentUserId;
                const msgReactions = reactions?.[msg.id] || [];
                const isStarred = starredMessages?.isStarred(msg.id);
                const urlInContent = linkPreview?.extractUrl(msg.content);

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`mensajes-msg ${isSent ? 'sent' : 'received'}`}
                    onContextMenu={(e) => handleContextMenu(e, msg.id)}
                    onMouseEnter={() => setHoveredMsgId(msg.id)}
                    onMouseLeave={() => setHoveredMsgId(null)}
                    style={{ position: 'relative', transition: 'background 0.3s' }}
                  >
                    {!isSent && (
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px', color: 'var(--mc-blue-light)', paddingLeft: '4px' }}>
                        {msg.senderName}
                      </div>
                    )}

                    {msg.mediaUrl && (
                      <div className="mensajes-msg-media">
                        {msg.mediaType === 'image' ? <img src={msg.mediaUrl} alt="" loading="lazy" />
                          : msg.mediaType === 'video' ? <video src={msg.mediaUrl} controls preload="metadata" />
                          : msg.mediaType === 'audio' ? <audio src={msg.mediaUrl} controls preload="metadata" style={{ maxWidth: '240px' }} /> : null}
                      </div>
                    )}

                    {msg.content && (
                      <div className="mensajes-msg-bubble">
                        <MentionText text={msg.content} />
                      </div>
                    )}

                    {/* v8: Link Preview */}
                    {urlInContent && linkPreview && (
                      <LinkPreviewCard url={urlInContent} preview={linkPreview.previews.get(urlInContent) ?? null} onFetch={linkPreview.fetchPreview} />
                    )}

                    {/* v8: Reactions */}
                    {msgReactions.length > 0 && onToggleReaction && (
                      <ReactionBadge reactions={msgReactions} onToggle={(emoji) => onToggleReaction(msg.id, emoji)} />
                    )}

                    <div className="mensajes-msg-meta">
                      {isStarred && <Star size={10} style={{ color: '#fbbf24', fill: '#fbbf24', marginRight: '2px' }} />}
                      {msg.editedAt && <span style={{ fontSize: '10px', color: 'var(--mc-text-muted)', marginRight: '4px' }}>editado</span>}
                      <span className="mensajes-msg-time">{formatTime(msg.createdAt)}</span>
                    </div>

                    {/* Hover action buttons */}
                    {hoveredMsgId === msg.id && (
                      <div style={{ position: 'absolute', top: '0', [isSent ? 'left' : 'right']: '-130px', display: 'flex', gap: '2px', background: 'var(--mc-sidebar)', borderRadius: '0', padding: '2px', border: '1px solid var(--mc-border)', zIndex: 10 }}>
                        {/* v8: Reaction trigger */}
                        {onToggleReaction && (
                          <button onClick={(e) => { e.stopPropagation(); setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id); }} title="Reaccionar" style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px', display: 'flex' }}><SmilePlus size={14} /></button>
                        )}
                        {/* v8: Pin */}
                        {onPinMessage && isAdmin && (
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
                        {/* v8: Thread */}
                        {threadReplies && (
                          <button onClick={() => threadReplies.openThread(msg.id, msg.content, msg.senderName, 'group_messages')} title="Ver hilo" style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', cursor: 'pointer', padding: '6px', display: 'flex' }}><Reply size={14} /></button>
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
        <div ref={messagesEndRef} />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: 'var(--mc-sidebar)', border: '1px solid var(--mc-border)', borderRadius: '0', padding: '4px', zIndex: 60, minWidth: '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          {onToggleStar && (
            <button className="mensajes-settings-item" onClick={() => { const msg = messageMap.get(contextMenu.msgId); if (msg) onToggleStar(msg.id, msg.content); setContextMenu(null); }}>
              <Star size={16} /> {starredMessages?.isStarred(contextMenu.msgId) ? 'Desmarcar' : 'Destacar'}
            </button>
          )}
          {onPinMessage && isAdmin && (
            <button className="mensajes-settings-item" onClick={() => { const msg = messageMap.get(contextMenu.msgId); if (msg) onPinMessage(msg.id, msg.content); setContextMenu(null); }}>
              <Pin size={16} /> Fijar
            </button>
          )}
          {(() => { const msg = messageMap.get(contextMenu.msgId); return msg && msg.senderId === currentUserId && onStartEdit && canEditMessage?.(msg.senderId, msg.createdAt); })() && (
            <button className="mensajes-settings-item" onClick={() => { const msg = messageMap.get(contextMenu.msgId); if (msg && onStartEdit) onStartEdit(msg.id, msg.content); setContextMenu(null); }}>
              <Edit3 size={16} /> Editar
            </button>
          )}
          {threadReplies && (
            <button className="mensajes-settings-item" onClick={() => { const msg = messageMap.get(contextMenu.msgId); if (msg) threadReplies.openThread(msg.id, msg.content, msg.senderName, 'group_messages'); setContextMenu(null); }}>
              <Reply size={16} /> Ver hilo
            </button>
          )}
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div style={{ padding: '8px 20px', background: 'rgba(245,158,11,0.1)', borderTop: '1px solid rgba(245,158,11,0.2)', textAlign: 'center', color: 'var(--mc-blue)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid var(--mc-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Subiendo archivo...
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

      {/* Input */}
      <div className="mensajes-input-area" style={{ position: 'relative' }}>
        {showEmojiPicker && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}

        {/* v8: Mention Autocomplete */}
        {mentions?.showSuggestions && (
          <MentionAutocomplete suggestions={mentions.suggestions} activeIndex={mentionActiveIdx} onSelect={handleMentionSelect} />
        )}

        <div className="mensajes-input-actions">
          <button className="mensajes-input-btn" title="Emoji" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            style={showEmojiPicker ? { color: 'var(--mc-blue)' } : {}}><Smile size={20} /></button>
          {!editingMessage && (
            <button className="mensajes-input-btn" title="Adjuntar" onClick={() => fileInputRef.current?.click()}
              disabled={uploading || audioRecorder.isRecording}
              style={uploading || audioRecorder.isRecording ? { opacity: 0.4, cursor: 'not-allowed' } : {}}><Paperclip size={20} /></button>
          )}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
            style={{ display: 'none' }} onChange={handleFileSelect} multiple />
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
                placeholder={editingMessage ? 'Edita tu mensaje...' : 'Escribe un mensaje al grupo...'}
                value={editingMessage ? editText : inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown} rows={1} disabled={uploading} />
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
    </div>
  );
};

export default GroupChatWindow;