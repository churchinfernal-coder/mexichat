import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageCircle, Shield, Camera, Settings, X as XIcon,
  User, Users, LogOut, Phone, Key, Palette, Globe, Type, AlertTriangle,
} from 'lucide-react';
import { useTheme, ACCENT_COLORS, FONT_FAMILIES, type ThemeId, type FontFamily } from '@/contexts/ThemeContext';
import { NATIONALITIES, GENDERS } from '@/config/nationalities';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { deleteUserAccount, exportUserData } from '@/services/accountDeletion';
import { useCallContext } from '@/contexts/CallContext';
import { supabase } from '@/integrations/supabase/client';
import { sendPushNotification } from '@/utils/pushNotify';

// ──────────────────────────────
// COMPONENTS — existing
// ──────────────────────────────
import ChatSidebar from '@/components/messaging/ChatSidebar';
import ChatWindow from '@/components/messaging/ChatWindow';
import GroupChatWindow from '@/components/messaging/GroupChatWindow';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDialog from '@/components/chat/ConfirmDialog';
import ReportDialog from '@/components/chat/ReportDialog';
import ForwardModal from '@/components/chat/ForwardModal';
import NewChatModal from '@/components/messaging/NewChatModal';
// ──────────────────────────────
// COMPONENTS — v8 new
// ──────────────────────────────
import GroupInviteModal from '@/components/chat/GroupInviteModal';
import GroupJoinRequestsPanel from '@/components/chat/GroupJoinRequestsPanel';
import MessageSearchBar from '@/components/chat/MessageSearchBar';
import PinnedMessageBar from '@/components/chat/PinnedMessageBar';
import SharedMediaPanel from '@/components/chat/SharedMediaPanel';
import ChatLockScreen from '@/components/chat/ChatLockScreen';
import { ReminderModal, ReminderAlert } from '@/components/chat/ReminderComponents';
import RingtonePicker from '@/components/settings/RingtonePicker';
import WallpaperPicker from '@/components/chat/WallpaperPicker';
import PaymentRequestModal from '@/components/chat/PaymentRequestModal';

// ──────────────────────────────
// HOOKS — existing
// ──────────────────────────────
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useMessagePagination } from '@/hooks/useMessagePagination';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { processAutoResponse, findOrCreateConversation } from '@/services/adminService';
import { useConversations } from '@/hooks/useConversations';
import { useGroups } from '@/hooks/useGroups';
import { useE2EE } from '@/hooks/useE2EE';
import { useDisappearingMessages } from '@/hooks/useDisappearingMessages';
import { useBulkSelect } from '@/hooks/useBulkSelect';

// ──────────────────────────────
// HOOKS — v8 new
// ────────────────��─────────────
import { useGroupInvites } from '@/hooks/useGroupInvites';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { useMessageEdit } from '@/hooks/useMessageEdit';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { usePinnedMessages } from '@/hooks/usePinnedMessages';
import { useMentions } from '@/hooks/useMentions';
import { useDeliveryStatus } from '@/hooks/useDeliveryStatus';
import { useSharedMedia } from '@/hooks/useSharedMedia';
import { useLinkPreview } from '@/hooks/useLinkPreview';
import { useStarredMessages } from '@/hooks/useStarredMessages';
import { useArchivedChats } from '@/hooks/useArchivedChats';
import { useChatDrafts } from '@/hooks/useChatDrafts';
import { useGroupMute } from '@/hooks/useGroupMute';
import { usePrivacySettings } from '@/hooks/usePrivacySettings';
import { useChatLock } from '@/hooks/useChatLock';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useChatExport } from '@/hooks/useChatExport';
import AppTutorial from '@/components/tutorial/AppTutorial';
import { useTutorial } from '@/hooks/useTutorial';
import { useThreadReplies } from '@/hooks/useThreadReplies';
import { useChatWallpaper } from '@/hooks/useChatWallpaper';
import { useReminders } from '@/hooks/useReminders';
import { useScheduledMessages } from '@/hooks/useScheduledMessages';
import { usePerChatReadReceipts } from '@/hooks/usePerChatReadReceipts';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useChannels } from '@/hooks/useChannels';

// ──────────────────────────────
// UTILS
// ──────────────────────────────
import {
  type ProfileRow,
  type ConversationItem,
  type GroupItem,
  type GroupMessage,
  type GroupMember,
  type GroupInfo,
  type GroupRole,
  type Message,
  str,
  bool,
  safeRole,
  mapDmMessage,
  mapGroupMessage,
  mapGroupMember,
  mapGroupInfo,
} from '@/utils/messageMappers';

import '@/styles/Mensajes.css';

export type { ConversationItem, GroupItem, Message, GroupMessage, GroupMember, GroupInfo };

// ──────────────────────────────
// MEXICHAT DESIGN TOKENS (inline styles)
// ──────────────────────────────

const MC = {
  sidebar: '#ffffff',
  sidebarHover: 'rgba(29, 78, 216, 0.04)',
  sidebarActive: 'rgba(29, 78, 216, 0.08)',
  chatBg: '#f8fafc',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#94a3b8',
  blue: '#1d4ed8',
  blueLight: '#3b82f6',
  online: '#22c55e',
  offline: '#cbd5e1',
  inputBg: '#f1f5f9',
  overlay: 'rgba(0, 0, 0, 0.4)',
  danger: '#ef4444',
} as const;

// ──────────────────────────────
// SECURITY CONSTANTS
// ──────────────────────────────

const MAX_SEARCH_QUERY_LENGTH = 50;
const MIN_SEARCH_INTERVAL_MS = 350;
const MAX_FULLNAME_LENGTH = 80;
const MAX_USERNAME_LENGTH = 30;
const MAX_BIO_LENGTH = 150;
const MAX_GROUP_NAME_LENGTH = 60;
const MAX_GROUP_DESC_LENGTH = 300;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_REPORT_CATEGORIES = new Set([
  'spam', 'harassment', 'fake', 'underage', 'scam', 'csam', 'extortion', 'threats', 'other',
]);
const SAFE_AVATAR_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const REPORT_RATE_LIMIT_MS = 10_000;
const PROMOTE_RATE_LIMIT_MS = 2_000;

// ──────────────────────────────
// SUPABASE UNTYPED TABLE HELPER
// ──────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function untypedFrom(table: string): any {
  return (supabase as any).from(table);
}

// ──────────────────────────────
// VALIDATION HELPERS
// ──────────────────────────────

function isValidUUID(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

function sanitizeSearchQuery(raw: string): string {
  return raw
    .slice(0, MAX_SEARCH_QUERY_LENGTH)
    .replace(/[%_\\'"`;]/g, '')
    .trim();
}

function sanitizeReportCategory(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return ALLOWED_REPORT_CATEGORIES.has(lower) ? lower : 'other';
}

// ──────────────────────────────
// TYPE-SAFE WINDOW ACCESSOR
// ──────────────────────────────

function setWindowActiveConvId(id: string | null) {
  (window as unknown as Record<string, unknown>).__mc_active_conv_id = id ?? undefined;
}

// ──────────────────────────────
// AVATAR UPLOAD UTILITY
// ──────────────────────────────

async function uploadAvatar(
  file: File,
  bucket: string,
  path: string,
): Promise<string | null> {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    toast.error('Formato no soportado. Usa JPG, PNG, GIF o WebP');
    return null;
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    toast.error('Imagen demasiado grande (max 5MB)');
    return null;
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = SAFE_AVATAR_EXTENSIONS.has(ext) ? ext : 'jpg';
  const fileName = `${path}/${Date.now()}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error('[Avatar] upload error:', uploadError.message);
    toast.error('Error al subir imagen');
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

// ──────────────────────────────
// RATE LIMITER
// ──────────────────────────────

function createRateLimiter(intervalMs: number): () => boolean {
  let lastCall = 0;
  return () => {
    const now = Date.now();
    if (now - lastCall < intervalMs) return false;
    lastCall = now;
    return true;
  };
}

// ──────────────────────────────
// SIMPLE SEARCH HOOK (carrier-grade)
// ──────────────────────────────

function useSimpleSearch(myUserId: string | undefined, blockedIds: Set<string>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const mountedRef = useRef(true);
  const lastSearchRef = useRef(0);
  const blockedIdsRef = useRef(blockedIds);

  useEffect(() => { blockedIdsRef.current = blockedIds; }, [blockedIds]);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!myUserId || query.length < 2) {
      setResults([]);
      return;
    }

    const sanitized = sanitizeSearchQuery(query);
    if (sanitized.length < 2) { setResults([]); return; }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const now = Date.now();
      const elapsed = now - lastSearchRef.current;
      if (elapsed < MIN_SEARCH_INTERVAL_MS) {
        await new Promise(r => setTimeout(r, MIN_SEARCH_INTERVAL_MS - elapsed));
      }
      lastSearchRef.current = Date.now();

      try {
        const { data, error } = await supabase.from('profiles')
          .select('id, full_name, avatar_url, username, is_online, phone')
          .neq('id', myUserId)
          .or(`full_name.ilike.%${sanitized}%,username.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`)
          .limit(20);
        if (!mountedRef.current) return;
        if (error) { console.error('[Search] query error:', error); setResults([]); return; }
        const filtered = (data || [])
          .map((p: Record<string, unknown>) => ({ ...p, user_id: p.id } as unknown as ProfileRow))
          .filter((p) => !blockedIdsRef.current.has(p.user_id));
        setResults(filtered);
      } catch (err) {
        console.error('[Search] unexpected error:', err);
        if (mountedRef.current) setResults([]);
      } finally {
        if (mountedRef.current) setIsSearching(false);
      }
    }, MIN_SEARCH_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [query, myUserId]);

  const clear = useCallback(() => { setQuery(''); setResults([]); }, []);
  return { query, setQuery, results, isSearching, clear };
}

// ──────────────────────────────
// SETTINGS PANEL COMPONENT
// ──────────────────────────────

interface SettingsPanelProps {
  profile: ProfileRow;
  onClose: () => void;
  onProfileUpdated: (profile: ProfileRow) => void;
  privacySettings: ReturnType<typeof usePrivacySettings>;
  chatLock: ReturnType<typeof useChatLock>;
  blockedIds: Set<string>;
  setBlockedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onTriggerTutorial: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  profile, onClose, onProfileUpdated, privacySettings, chatLock,
  blockedIds, setBlockedIds, onTriggerTutorial,
}) => {
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState(str(profile.full_name, ''));
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(String((profile as unknown as Record<string, unknown>).bio ?? ''));
  const [nationality, setNationality] = useState(String((profile as unknown as Record<string, unknown>).nationality ?? ''));
  const [gender, setGender] = useState(String((profile as unknown as Record<string, unknown>).gender ?? ''));
  const [saving, setSaving] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'privacy' | 'security' | 'appearance'>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { signOut } = useAuth();
  const theme = useTheme();

  const [blockedProfiles, setBlockedProfiles] = useState<ProfileRow[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [sentReports, setSentReports] = useState<Record<string, unknown>[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const blockedIdsKey = useMemo(() => [...blockedIds].sort().join(','), [blockedIds]);

  useEffect(() => {
    if (activeSettingsTab !== 'privacy' || !profile.user_id) return;
    let cancelled = false;
    setLoadingBlocked(true);
    (async () => {
      try {
        const { data: blocked, error } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', profile.user_id);
        if (cancelled) return;
        if (error) { console.error('[Settings] blocked fetch error:', error); setLoadingBlocked(false); return; }
        if (!blocked || blocked.length === 0) { setBlockedProfiles([]); setLoadingBlocked(false); return; }
        const ids = blocked.map((b: Record<string, unknown>) => b.blocked_id as string);
        const { data: profs } = await supabase.from('profiles').select('id, full_name, avatar_url, username').in('id', ids);
        if (cancelled) return;
        setBlockedProfiles((profs || []).map((p: Record<string, unknown>) => ({ ...p, user_id: p.id } as unknown as ProfileRow)));
      } catch (err) {
        console.error('[Settings] blocked users error:', err);
        if (!cancelled) setBlockedProfiles([]);
      }
      if (!cancelled) setLoadingBlocked(false);
    })();
    return () => { cancelled = true; };
  }, [activeSettingsTab, profile.user_id, blockedIdsKey]);

  useEffect(() => {
    if (activeSettingsTab !== 'privacy' || !profile.user_id) return;
    let cancelled = false;
    setLoadingReports(true);
    (async () => {
      try {
        const { data: reports } = await untypedFrom('reported_users').select('*').eq('reporter_id', profile.user_id).order('created_at', { ascending: false }).limit(50);
        if (cancelled) return;
        if (!reports || reports.length === 0) { setSentReports([]); setLoadingReports(false); return; }
        const reportedIds = [...new Set((reports as Record<string, unknown>[]).map((r) => r.reported_id as string))];
        const { data: profs } = await supabase.from('profiles').select('id, full_name, avatar_url, username').in('id', reportedIds);
        if (cancelled) return;
        const profMap = new Map((profs || []).map((p: Record<string, unknown>) => [p.id as string, p]));
        setSentReports((reports as Record<string, unknown>[]).map((r) => {
          const rp = profMap.get(r.reported_id as string) as Record<string, unknown> | undefined;
          return {
            ...r,
            reported_name: rp?.full_name || 'Desconocido',
            reported_avatar: rp?.avatar_url ?? null,
            reported_username: rp?.username ?? null,
          };
        }));
      } catch (err) {
        console.error('[Settings] reports fetch error:', err);
        if (!cancelled) setSentReports([]);
      }
      if (!cancelled) setLoadingReports(false);
    })();
    return () => { cancelled = true; };
  }, [activeSettingsTab, profile.user_id]);

  const handleUnblockUser = async (targetId: string) => {
    if (!isValidUUID(targetId)) return;
    setUnblockingId(targetId);
    try {
      const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', profile.user_id).eq('blocked_id', targetId);
      if (error) { toast.error('Error al desbloquear: ' + (error.message || '')); return; }
      setBlockedIds((prev) => { const next = new Set(prev); next.delete(targetId); return next; });
      setBlockedProfiles(prev => prev.filter((p) => p.user_id !== targetId));
      toast.success('Usuario desbloqueado');
    } catch (err) {
      console.error('[Settings] unblock error:', err);
      toast.error('Error al desbloquear');
    } finally {
      setUnblockingId(null);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(file, 'avatars', `profiles/${profile.user_id}`);
      if (url) {
        const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.user_id);
        if (error) { toast.error('Error al actualizar avatar'); return; }
        onProfileUpdated({ ...profile, avatar_url: url } as ProfileRow);
        toast.success('Avatar actualizado');
      }
    } catch (err) {
      console.error('[Settings] avatar change error:', err);
      toast.error('Error al cambiar avatar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async () => {
    const trimmedName = fullName.trim().slice(0, MAX_FULLNAME_LENGTH);
    if (!trimmedName) { toast.error('Nombre requerido'); return; }
    const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, MAX_USERNAME_LENGTH);
    const trimmedBio = bio.trim().slice(0, MAX_BIO_LENGTH);

    setSaving(true);
    try {
      const updates: Record<string, string | null> = { full_name: trimmedName };
      if (trimmedUsername) updates.username = trimmedUsername;
      if (trimmedBio !== String((profile as unknown as Record<string, unknown>).bio ?? '')) updates.bio = trimmedBio;
      if (nationality !== String((profile as unknown as Record<string, unknown>).nationality ?? '')) updates.nationality = nationality || null;
      if (gender !== String((profile as unknown as Record<string, unknown>).gender ?? '')) updates.gender = gender || null;
      const { error } = await supabase.from('profiles').update(updates).eq('id', profile.user_id);
      if (error) { toast.error('Error al guardar: ' + (error.message || '')); return; }
      onProfileUpdated({ ...profile, full_name: updates.full_name ?? profile.full_name, username: updates.username || profile.username } as ProfileRow);
      toast.success('Perfil actualizado');
    } catch (err) {
      console.error('[Settings] save profile error:', err);
      toast.error('Error al guardar perfil');
    } finally {
      setSaving(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExportData = async () => {
    if (!profile.user_id) return;
    setExportLoading(true);
    try {
      const data = await exportUserData(profile.user_id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mexichat-data-export.json'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Datos exportados correctamente');
    } catch (err) {
      console.error('[Settings] export error:', err);
      toast.error('Error al exportar datos');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!profile.user_id) return;
    setDeleteLoading(true);
    try {
      const result = await deleteUserAccount(profile.user_id);
      if (result.success) {
        toast.success('Cuenta eliminada permanentemente');
        window.location.href = '/auth';
      } else {
        toast.error(result.error || 'Error al eliminar cuenta');
      }
    } catch (err) {
      console.error('[Settings] delete account error:', err);
      toast.error('Error al eliminar cuenta');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Sesion cerrada');
    } catch (err) {
      console.error('[Settings] sign out error:', err);
      toast.error('Error al cerrar sesion');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: MC.overlay, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: MC.sidebar, borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '85vh', border: `1px solid ${MC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${MC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '16px', color: MC.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} style={{ color: MC.blue }} /> Configuracion
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: MC.textMuted, cursor: 'pointer', padding: '4px' }}>
            <XIcon size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${MC.border}` }}>
          {(['profile', 'privacy', 'security', 'appearance'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSettingsTab(tab)}
              style={{
                flex: 1, padding: '10px', background: 'none', border: 'none',
                borderBottom: activeSettingsTab === tab ? `2px solid ${MC.blue}` : '2px solid transparent',
                color: activeSettingsTab === tab ? MC.blue : MC.textMuted,
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {tab === 'profile' ? 'Perfil' : tab === 'privacy' ? 'Privacidad' : tab === 'security' ? 'Seguridad' : 'Apariencia'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
          {/* ────────── PROFILE TAB */}
          {activeSettingsTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ position: 'relative', width: '96px', height: '96px' }}>
                  <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: MC.inputBg, border: `3px solid ${MC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: '32px', fontWeight: 700, color: MC.textMuted }}>
                    {profile.avatar_url ? <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={40} />}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '32px', height: '32px', borderRadius: '50%', background: MC.blue, border: `2px solid ${MC.sidebar}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'wait' : 'pointer', color: 'white' }} title="Cambiar avatar">
                    {uploading ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'mc-spin 0.8s linear infinite' }} /> : <Camera size={14} />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
                </div>
                <span style={{ fontSize: '12px', color: MC.textMuted }}>Toca el icono para cambiar tu foto</span>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '6px', display: 'block' }}>Nombre completo *</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value.slice(0, MAX_FULLNAME_LENGTH))} placeholder="Tu nombre"
                  style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '6px', display: 'block' }}>Nombre de usuario</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: MC.textMuted, fontSize: '14px' }}>@</span>
                  <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, MAX_USERNAME_LENGTH))} placeholder="usuario"
                    style={{ width: '100%', padding: '10px 14px 10px 28px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              {profile.phone && (
                <div>
                  <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '6px', display: 'block' }}>Telefono</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', fontSize: '14px', color: MC.textMuted }}>
                    <Phone size={14} /> {profile.phone}
                  </div>
                </div>
              )}
              <div>
                <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '6px', display: 'block' }}>Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))} placeholder="Escribe algo sobre ti..."
                  rows={3} style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                <span style={{ fontSize: '11px', color: MC.textMuted, float: 'right' }}>{bio.length}/{MAX_BIO_LENGTH}</span>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={14} /> Nacionalidad <span style={{ fontSize: '11px', opacity: 0.6 }}>(opcional)</span>
                </label>
                <select value={nationality} onChange={(e) => setNationality(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', cursor: 'pointer' }}>
                  <option value="">Seleccionar...</option>
                  {NATIONALITIES.map(n => <option key={n.code} value={n.code}>{n.flag} {n.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '6px', display: 'block' }}>Genero <span style={{ fontSize: '11px', opacity: 0.6 }}>(opcional)</span></label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', cursor: 'pointer' }}>
                  <option value="">Seleccionar...</option>
                  {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <RingtonePicker lang="es" />
              <button onClick={handleSaveProfile} disabled={saving}
                style={{ padding: '10px', background: MC.blue, border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '14px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button onClick={() => { onTriggerTutorial(); onClose(); }}
                style={{ padding: '10px', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '8px', color: '#3b82f6', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Globe size={16} /> Ver Tutorial
              </button>
              <button onClick={handleSignOut}
                style={{ padding: '10px', background: 'transparent', border: `1px solid ${MC.danger}`, borderRadius: '8px', color: MC.danger, fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <LogOut size={16} /> Cerrar sesion
              </button>
            </div>
          )}

          {/* ────────── PRIVACY TAB */}
          {activeSettingsTab === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {([
                { label: '\u00daltima vez visto', key: 'lastSeenVisibility' as const },
                { label: 'Estado en linea', key: 'onlineVisibility' as const },
                { label: 'Foto de perfil', key: 'avatarVisibility' as const },
              ]).map(item => (
                <div key={item.key}>
                  <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '6px', display: 'block' }}>{item.label}</label>
                  <select
                    value={privacySettings.privacy[item.key]}
                    onChange={(e) => privacySettings.updatePrivacy({ [item.key]: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px' }}
                  >
                    <option value="everyone">Todos</option>
                    <option value="contacts">Solo contactos</option>
                    <option value="nobody">Nadie</option>
                  </select>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                <div>
                  <div style={{ fontSize: '14px', color: MC.text, fontWeight: 600 }}>Confirmaciones de lectura</div>
                  <div style={{ fontSize: '12px', color: MC.textMuted }}>Mostrar</div>
                </div>
                <button
                  onClick={() => privacySettings.updatePrivacy({ readReceipts: !privacySettings.privacy.readReceipts })}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                    background: privacySettings.privacy.readReceipts ? MC.blue : '#cbd5e1',
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', transition: 'left 0.2s',
                    left: privacySettings.privacy.readReceipts ? '23px' : '3px',
                  }} />
                </button>
              </div>

              {/* BLACKLIST */}
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid ' + MC.border }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} style={{ color: MC.danger }} />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: MC.text }}>Usuarios Bloqueados</span>
                  </div>
                  {blockedProfiles.length > 0 && (
                    <span style={{ background: 'rgba(239,68,68,0.1)', color: MC.danger, padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                      {blockedProfiles.length}
                    </span>
                  )}
                </div>
                {loadingBlocked ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: MC.textMuted, fontSize: '13px' }}>Cargando...</div>
                ) : blockedProfiles.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', background: MC.inputBg, borderRadius: '10px', border: '1px solid ' + MC.border }}>
                    <div style={{ fontSize: '13px', color: MC.textMuted }}>No tienes usuarios bloqueados</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {blockedProfiles.map((bp) => (
                      <div key={bp.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: MC.inputBg, borderRadius: '10px', border: '1px solid ' + MC.border }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: MC.border, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {bp.avatar_url ? <img src={bp.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={18} style={{ color: MC.textMuted }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: MC.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bp.full_name || 'Usuario'}</div>
                          {bp.username && <div style={{ fontSize: '11px', color: MC.textMuted }}>@{bp.username}</div>}
                        </div>
                        <button onClick={() => handleUnblockUser(bp.user_id)} disabled={unblockingId === bp.user_id}
                          style={{ padding: '5px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: MC.danger, fontSize: '11px', fontWeight: 600, cursor: unblockingId === bp.user_id ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                          {unblockingId === bp.user_id ? '...' : 'Desbloquear'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* REPORTES ENVIADOS */}
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid ' + MC.border }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: MC.text }}>Reportes Enviados</span>
                  {sentReports.length > 0 && (
                    <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, marginLeft: 'auto' }}>
                      {sentReports.length}
                    </span>
                  )}
                </div>
                {loadingReports ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: MC.textMuted, fontSize: '13px' }}>Cargando...</div>
                ) : sentReports.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', background: MC.inputBg, borderRadius: '10px', border: '1px solid ' + MC.border }}>
                    <div style={{ fontSize: '13px', color: MC.textMuted }}>No has enviado reportes</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {sentReports.map((r) => {
                      const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                        pending: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                        reviewed: { label: 'Revisado', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                        action_taken: { label: 'Accion tomada', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
                        dismissed: { label: 'Descartado', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
                      };
                      const st = statusMap[(r.status as string) || 'pending'] || statusMap.pending;
                      const cat = ((r.reason as string) || '').replace(/^\[/, '').replace(/\].*/, '');
                      const catLabels: Record<string, string> = { spam: 'Spam', harassment: 'Acoso', fake: 'Perfil falso', underage: 'Menor', scam: 'Estafa', csam: 'CSAM', extortion: 'Extorsion', threats: 'Amenazas', other: 'Otro' };
                      return (
                        <div key={r.id as string} style={{ padding: '10px 12px', background: MC.inputBg, borderRadius: '10px', border: '1px solid ' + MC.border }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: MC.border, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {r.reported_avatar ? <img src={r.reported_avatar as string} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={14} style={{ color: MC.textMuted }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: MC.text }}>{String(r.reported_name ?? 'Desconocido')}</span>
                              {r.reported_username ? <span style={{ fontSize: '11px', color: MC.textMuted, marginLeft: '6px' }}>@{String(r.reported_username)}</span> : null}     
                            </div>
                            <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: MC.textMuted }}>
                            <span style={{ background: 'rgba(239,68,68,0.08)', color: MC.danger, padding: '1px 8px', borderRadius: '6px', fontWeight: 600 }}>{catLabels[cat] || cat || 'Reporte'}</span>
                            <span>{r.created_at ? new Date(r.created_at as string).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────────── SECURITY TAB */}
          {activeSettingsTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px', background: MC.inputBg, borderRadius: '12px', border: `1px solid ${MC.border}` }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: MC.text, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Key size={16} style={{ color: MC.blue }} /> Bloqueo con PIN
                </div>
                <div style={{ fontSize: '12px', color: MC.textMuted, marginBottom: '12px' }}>
                  {chatLock.hasPin ? 'PIN configurado. Tus chats estan protegidos.' : 'Protege tus chats con un PIN de acceso.'}
                </div>
                {chatLock.hasPin ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { chatLock.lock(); onClose(); toast.success('Chat bloqueado'); }}
                      style={{ flex: 1, padding: '8px', background: MC.blue, border: 'none', borderRadius: '8px', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                      Bloquear ahora
                    </button>
                    <button onClick={chatLock.removePin}
                      style={{ flex: 1, padding: '8px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                      Eliminar PIN
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { chatLock.setShowSetup(true); onClose(); }}
                    style={{ width: '100%', padding: '8px', background: MC.blue, border: 'none', borderRadius: '8px', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                    Configurar PIN
                  </button>
                )}
              </div>
              <div style={{ padding: '16px', background: MC.inputBg, borderRadius: '12px', border: `1px solid ${MC.border}` }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: MC.text, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={16} style={{ color: MC.online }} /> Cifrado de extremo a extremo
                </div>
                <div style={{ fontSize: '12px', color: MC.textMuted }}>
                  Tus mensajes privados estan cifrados. Solo tu y el destinatario pueden leerlos.
                </div>
              </div>
              <div style={{ padding: '16px', background: MC.inputBg, borderRadius: '12px', border: `1px solid ${MC.border}` }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: MC.text, marginBottom: '8px' }}>Sesion activa</div>
                <div style={{ fontSize: '12px', color: MC.textMuted, marginBottom: '4px' }}>
                  Navegador: {navigator.userAgent.includes('Mobile') ? 'Movil' : 'Escritorio'}
                </div>
                <div style={{ fontSize: '12px', color: MC.textMuted }}>
                  {'\u00da'}ltima actividad: {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          )}

          {/* ────────── APPEARANCE TAB */}
          {activeSettingsTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Palette size={14} /> Tema de interfaz
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                  {([
                    { id: 'platinum' as ThemeId, name: 'Platinum', desc: 'Glassmorphism', gradient: 'linear-gradient(135deg, rgba(255,255,255,0.8), rgba(200,210,230,0.6))' },
                    { id: 'diamond' as ThemeId, name: 'Diamond', desc: 'Clasico verde', gradient: 'linear-gradient(135deg, #00a884, #008069)' },
                    { id: 'gold' as ThemeId, name: 'Gold', desc: 'Azul minimal', gradient: 'linear-gradient(135deg, #517da2, #6ea5d7)' },
                    { id: 'obsidian' as ThemeId, name: 'Obsidian', desc: 'Black Glass', gradient: 'linear-gradient(135deg, #0a0a0f, #1a1a2e)' },
                  ]).map(t => (
                    <button key={t.id} onClick={() => theme.setTheme(t.id)}
                      style={{
                        padding: '14px 8px', borderRadius: '12px', border: theme.config.themeId === t.id ? `2px solid ${MC.blue}` : `1px solid ${MC.border}`,
                        background: t.gradient, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        boxShadow: theme.config.themeId === t.id ? `0 0 0 2px ${MC.blue}20` : 'none', transition: 'all 0.2s',
                      }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: t.id === 'platinum' ? MC.text : '#fff' }}>{t.name}</span>
                      <span style={{ fontSize: '10px', color: t.id === 'platinum' ? MC.textMuted : 'rgba(255,255,255,0.8)' }}>{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '10px', display: 'block' }}>Color de acento</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {Object.entries(ACCENT_COLORS).map(([key, color]) => (
                    <button key={key} onClick={() => theme.setAccent(key)} title={color.name}
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%', border: theme.config.accentColor === key ? '3px solid ' + color.primary : '2px solid ' + MC.border,
                        background: color.primary, cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                        boxShadow: theme.config.accentColor === key ? `0 0 0 3px ${color.bg}` : 'none',
                      }}>
                      {theme.config.accentColor === key && (
                        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>{'\u2713'}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Type size={14} /> Fuente
                </label>
                <select value={theme.config.fontFamily} onChange={(e) => theme.setFont(e.target.value as FontFamily)}
                  style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', cursor: 'pointer' }}>
                  {Object.entries(FONT_FAMILIES).map(([key, font]) => (
                    <option key={key} value={key}>{font.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ padding: '16px', background: MC.inputBg, borderRadius: '12px', border: `1px solid ${MC.border}` }}>
                <div style={{ fontSize: '12px', color: MC.textMuted, marginBottom: '8px' }}>Vista previa</div>
                <div style={{ fontFamily: theme.fontStack, fontSize: '14px', color: MC.text, lineHeight: '1.5' }}>
                  Hola, asi se vera tu texto con la fuente <strong>{FONT_FAMILIES[theme.config.fontFamily]?.name}</strong> y el color{' '}
                  <span style={{ color: theme.accent.primary, fontWeight: 700 }}>{theme.accent.name}</span>.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes mc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ──────────────────────────────
// GROUP AVATAR PICKER COMPONENT
// ──────────────────────────────

interface GroupAvatarPickerProps {
  avatarUrl: string | null;
  onAvatarSelected: (url: string) => void;
  groupId?: string;
  disabled?: boolean;
}

const GroupAvatarPicker: React.FC<GroupAvatarPickerProps> = ({ avatarUrl, onAvatarSelected, groupId, disabled }) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = groupId ? `groups/${groupId}` : `groups/new-${Date.now()}`;
      const url = await uploadAvatar(file, 'avatars', path);
      if (url) onAvatarSelected(url);
    } catch (err) {
      console.error('[GroupAvatar] upload error:', err);
      toast.error('Error al subir foto de grupo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: MC.inputBg, border: `2px solid ${MC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: MC.textMuted }}>
          {avatarUrl ? <img src={avatarUrl} alt="Grupo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={24} />}
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={disabled || uploading}
          style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '24px', height: '24px', borderRadius: '50%', background: MC.blue, border: `2px solid ${MC.sidebar}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (disabled || uploading) ? 'wait' : 'pointer', color: 'white' }}>
          {uploading ? <div style={{ width: '10px', height: '10px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'mc-spin 0.8s linear infinite' }} /> : <Camera size={10} />}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFile} style={{ display: 'none' }} />
      </div>
      <span style={{ fontSize: '12px', color: MC.textMuted }}>{avatarUrl ? 'Cambiar foto' : 'Agregar foto'}</span>
    </div>
  );
};

// ──────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────

const Mensajes: React.FC = () => {
  const { user } = useAuth();
  const myUserId = user?.id;
  const { activeCall } = useCallContext();
  const location = useLocation();
  const navigate = useNavigate();

  const locState = (location.state ?? {}) as { initialTab?: 'chats' | 'groups'; openSettings?: boolean; contactUserId?: string; contactName?: string };

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeOtherUserId, setActiveOtherUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>(locState.initialTab ?? 'chats');
  const [showMobile, setShowMobile] = useState<'sidebar' | 'chat'>('sidebar');
  const [myProfile, setMyProfile] = useState<ProfileRow | null>(null);

  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [activeGroupInfo, setActiveGroupInfo] = useState<GroupInfo | null>(null);
  const [myGroupRole, setMyGroupRole] = useState<GroupRole>('member');

  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettings, setShowSettings] = useState(locState.openSettings ?? false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupAvatar, setNewGroupAvatar] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  const [showGroupInviteModal, setShowGroupInviteModal] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showSharedMedia, setShowSharedMedia] = useState(false);

  const [autoAcceptCall, setAutoAcceptCall] = useState<'audio' | 'video' | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string;
    variant: 'danger' | 'warning' | 'info'; onConfirm: () => void;
  }>({ open: false, title: '', description: '', variant: 'danger', onConfirm: () => {} });
  const [reportDialog, setReportDialog] = useState<{ open: boolean; userName: string }>({ open: false, userName: '' });

  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());

  const profilesRef = useRef(new Map<string, ProfileRow>());
  const promoteRateLimiter = useMemo(() => createRateLimiter(PROMOTE_RATE_LIMIT_MS), []);
  const reportRateLimiter = useMemo(() => createRateLimiter(REPORT_RATE_LIMIT_MS), []);

  useEffect(() => {
    setWindowActiveConvId(activeConvId);
    return () => { setWindowActiveConvId(null); };
  }, [activeConvId]);

  // ──────────────────────────────
  // HOOKS — existing
  // ──────────────────────────────

  useOnlineStatus(myUserId ?? null);
  const trackEvent = useCallback((_name: string, _props?: Record<string, unknown>) => {}, []);
  const e2ee = useE2EE(myUserId);
  const bulkSelect = useBulkSelect();
  const disappearing = useDisappearingMessages(activeConvId);

  const { conversations, reload: reloadConversations, getProfile, getProfiles } = useConversations(myUserId, blockedIds);
  const { groups, reload: reloadGroups } = useGroups(myUserId);
  const search = useSimpleSearch(myUserId, blockedIds);

  const dmMapper = useCallback((row: Record<string, unknown>) => mapDmMessage(row), []);

  const {
    messages, setMessages, loading: messagesLoading, hasMore: hasMoreMessages,
    loadInitial: loadMessagesInitial, loadOlder: loadOlderMessages,
    addMessage: addDmMessage, updateMessage: updateDmMessage,
    removeMessage: removeDmMessage, removeMessages: removeDmMessages, reset: resetMessages,
  } = useMessagePagination<Message>('private_messages', 'conversation_id', dmMapper);

  const messagesLoadingRef = useRef(messagesLoading);
  useEffect(() => { messagesLoadingRef.current = messagesLoading; }, [messagesLoading]);

  // ──────────────────────────────
  // HOOKS — v8 new
  // ──────────────────────────────

  const groupInvites = useGroupInvites(myUserId);
  const dmReactions = useMessageReactions(myUserId, 'private_messages', activeConvId);
  const groupReactions = useMessageReactions(myUserId, 'group_messages', activeGroupId);
  const dmEdit = useMessageEdit(myUserId, 'private_messages');
  const groupEdit = useMessageEdit(myUserId, 'group_messages');
  const messageSearch = useMessageSearch(myUserId);
  const dmPinned = usePinnedMessages('conversation', activeConvId, myUserId);
  const groupPinned = usePinnedMessages('group', activeGroupId, myUserId);
  const mentions = useMentions(groupMembers);
  const deliveryStatus = useDeliveryStatus(activeConvId, myUserId);
  const sharedMedia = useSharedMedia();
  const linkPreview = useLinkPreview();
  const starredMessages = useStarredMessages(myUserId);
  const archivedChats = useArchivedChats(myUserId);
  const chatDrafts = useChatDrafts();
  const groupMute = useGroupMute(myUserId);
  const privacySettings = usePrivacySettings(myUserId);
  const chatLock = useChatLock();
  const notificationPrefs = useNotificationPreferences(myUserId);
  const chatExport = useChatExport();
  const { shouldShow: showTutorial, dismiss: dismissTutorial, trigger: triggerTutorial } = useTutorial(myUserId);
  const threadReplies = useThreadReplies(myUserId);
  const chatWallpaper = useChatWallpaper();
  const reminders = useReminders(myUserId);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const readReceipts = usePerChatReadReceipts();
  const paymentRequests = usePaymentRequests(myUserId);
  const channels = useChannels(myUserId);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Stable ref for loadArchived to prevent infinite loop
  const loadArchivedRef = useRef(archivedChats.loadArchived);
  useEffect(() => { loadArchivedRef.current = archivedChats.loadArchived; }, [archivedChats.loadArchived]);
  useEffect(() => { loadArchivedRef.current(); }, []);

  useEffect(() => {
    if (activeConvId) paymentRequests.loadRequests(activeConvId);
    else if (activeGroupId) paymentRequests.loadRequests(undefined, activeGroupId);
  }, [activeConvId, activeGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messages.length > 0 && activeConvId) {
      dmReactions.loadReactions(messages.map(m => m.id));
    }
  }, [messages, activeConvId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (groupMessages.length > 0 && activeGroupId) {
      groupReactions.loadReactions(groupMessages.map(m => m.id));
    }
  }, [groupMessages, activeGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeGroupId && (myGroupRole === 'owner' || myGroupRole === 'admin')) {
      groupInvites.loadJoinRequests(activeGroupId);
    }
  }, [activeGroupId, myGroupRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────────────────
  // REALTIME MESSAGES
  // ──────────────────────────────

  const activeConvIdRef = useRef<string | null>(null);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  useRealtimeMessages<Message>({
    table: 'private_messages',
    filterColumn: 'conversation_id',
    filterId: activeConvId,
    currentUserId: myUserId ?? null,
    mapper: dmMapper,
    onInsert: useCallback((msg: Message) => {
      addDmMessage(msg);
      if (msg.senderId !== myUserId) {
        if (activeConvIdRef.current && document.hasFocus()) {
          supabase.from('private_messages').update({ is_read: true }).eq('id', msg.id).then(() => {});
        }
      }
    }, [addDmMessage, myUserId]),
    onUpdate: useCallback((msg: Message) => { updateDmMessage(msg.id, () => msg); }, [updateDmMessage]),
    onDelete: useCallback((id: string) => { removeDmMessage(id); }, [removeDmMessage]),
  });

  // ──────────────���───────────────
  // GLOBAL NAVIGATION EVENT
  // ──────────────────────────────

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.conversationId) return;
      const convId = detail.conversationId as string;
      if (!isValidUUID(convId)) return;
      const fromUserId = detail.fromUserId as string | undefined;
      const autoCall = detail.autoAcceptCall as 'audio' | 'video' | undefined;
      setActiveConvId(convId); setActiveOtherUserId(fromUserId || null);
      setActiveGroupId(null); setActiveGroupInfo(null); setShowMobile('chat');
      resetMessages(); bulkSelect.stopSelecting();
      if (autoCall) setAutoAcceptCall(autoCall);
      loadMessagesInitial(convId);
      if (!autoCall && myUserId) {
        supabase.from('private_messages').update({ is_read: true })
          .eq('conversation_id', convId).neq('sender_id', myUserId).eq('is_read', false).then(() => {});
      }
    };
    window.addEventListener('mc-navigate-conversation', handleNavigate);
    return () => window.removeEventListener('mc-navigate-conversation', handleNavigate);
  }, [myUserId, resetMessages, bulkSelect, loadMessagesInitial]);

  useEffect(() => {
    if (autoAcceptCall) {
      const timer = setTimeout(() => setAutoAcceptCall(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [autoAcceptCall]);

  // ──────────────────────────────
  // PAGINATION SCROLL
  // ──────────────────────────────

  useEffect(() => {
    if (!activeConvId) return;
    const container = document.querySelector('.mensajes-messages');
    if (!container) return;
    const handleScroll = () => {
      if (container.scrollTop < 80 && hasMoreMessages.current && !messagesLoadingRef.current) {
        const prevHeight = container.scrollHeight;
        loadOlderMessages().then(() => {
          requestAnimationFrame(() => { container.scrollTop = container.scrollHeight - prevHeight; });
        }).catch((err) => console.error('[Pagination] load older error:', err));
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeConvId, loadOlderMessages, hasMoreMessages]);

  // ─────────────────────────────��
  // PROFILE + BLOCKED
  // ──────────────────────────────

  useEffect(() => {
    if (!myUserId) return;
    supabase.from('profiles')
      .select('*')
      .eq('id', myUserId).single()
      .then(({ data, error }) => {
        if (error) { console.error('[Profile] fetch error:', error); return; }
        if (data) setMyProfile({ ...data, user_id: data.id } as unknown as ProfileRow);
      });
  }, [myUserId]);

  useEffect(() => {
    if (!myUserId) return;
    supabase.from('blocked_users').select('blocked_id').eq('blocker_id', myUserId)
      .then(({ data, error }) => {
        if (error) { console.error('[Blocked] fetch error:', error); return; }
        if (data) setBlockedIds(new Set(data.map(r => r.blocked_id)));
      });
  }, [myUserId]);

  useEffect(() => {
    const p = getProfiles();
    p.forEach((v, k) => profilesRef.current.set(k, v));
  }, [conversations, getProfiles]);

  // ──────────────────────────────
  // GROUP MESSAGES
  // ──────────────────────────────

  const loadGroupMessages = useCallback(async (groupId: string) => {
    if (!isValidUUID(groupId) || !myUserId) {
      console.error('[Groups] invalid groupId or missing userId:', groupId, myUserId);
      return;
    }
    try {
      const [msgsResult, membersResult] = await Promise.all([
        supabase.from('group_messages')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true })
          .limit(200),
        supabase.from('group_members')
          .select('*')
          .eq('group_id', groupId),
      ]);

      if (msgsResult.error) console.error('[Groups] messages fetch error:', msgsResult.error);
      if (membersResult.error) console.error('[Groups] members fetch error:', membersResult.error);

      const membersData = membersResult.data;
      const memberUserIds: string[] = membersData?.map(m => m.user_id) ?? [];

      if (memberUserIds.length > 0) {
        const { data: memberProfiles } = await supabase.from('profiles')
          .select('id, full_name, avatar_url, username, is_online, last_seen, phone')
          .in('id', memberUserIds);
        if (memberProfiles) {
          for (const p of memberProfiles) {
            profilesRef.current.set(p.id, { ...p, user_id: p.id } as unknown as ProfileRow);
          }
          setGroupMembers(memberProfiles.map(p => {
            const memberRow = membersData?.find(m => m.user_id === p.id);
            return mapGroupMember(p as unknown as ProfileRow, memberRow?.role ?? 'member');
          }));
        }
      } else {
        setGroupMembers([]);
      }

      const myMembership = membersData?.find(m => m.user_id === myUserId);
      setMyGroupRole(safeRole(myMembership?.role));

      const { data: gInfo, error: gInfoError } = await supabase.from('groups').select('*').eq('id', groupId).single();
      if (gInfoError) console.error('[Groups] info fetch error:', gInfoError);
      if (gInfo) setActiveGroupInfo(mapGroupInfo(gInfo as unknown as Record<string, unknown>));

      if (msgsResult.data) {
        setGroupMessages(msgsResult.data.map(m => mapGroupMessage(m as unknown as Record<string, unknown>, profilesRef.current)));
      }

      // Best-effort read receipt
      try {
        await untypedFrom('group_read_receipts')
          .upsert(
            { group_id: groupId, user_id: myUserId, last_read_at: new Date().toISOString() },
            { onConflict: 'group_id,user_id' }
          );
      } catch { /* best-effort */ }
    } catch (err) {
      console.error('[Groups] loadGroupMessages critical error:', err);
      toast.error('Error al cargar grupo');
    }
  }, [myUserId]);

  // Realtime: group messages
  useEffect(() => {
    if (!activeGroupId || !myUserId) return;
    if (!isValidUUID(activeGroupId)) return;
    const gId = activeGroupId;
    const channel = supabase.channel(`group-messages:${gId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${gId}` }, (payload) => {
        const m = payload.new as Record<string, unknown>;
        const newMsg = mapGroupMessage(m, profilesRef.current);
        setGroupMessages(prev => { if (prev.some(msg => msg.id === newMsg.id)) return prev; return [...prev, newMsg]; });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${gId}` }, (payload) => {
        const m = payload.new as Record<string, unknown>;
        const updated = mapGroupMessage(m, profilesRef.current);
        setGroupMessages(prev => prev.map(msg => msg.id === updated.id ? updated : msg));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${gId}` }, (payload) => {
        const deletedId = (payload.old as Record<string, unknown>)?.id as string;
        if (deletedId) setGroupMessages(prev => prev.filter(msg => msg.id !== deletedId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeGroupId, myUserId]);

  // Realtime: group_members changes (role changes, members added/removed)
  useEffect(() => {
    if (!activeGroupId || !myUserId) return;
    if (!isValidUUID(activeGroupId)) return;
    const gId = activeGroupId;
    const channel = supabase.channel(`group-members-live:${gId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${gId}` }, () => {
        loadGroupMessages(gId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeGroupId, myUserId, loadGroupMessages]);

  // ──────────────────────────────
  // CONVERSATION / GROUP SELECTION
  // ──────────────────────────────

  const handleSelectConversation = useCallback(async (convId: string) => {
    if (!isValidUUID(convId)) return;
    if (activeConvId) {
      const input = document.querySelector('.mensajes-input-text') as HTMLInputElement | null;
      if (input?.value?.trim()) chatDrafts.setDraft(activeConvId, input.value);
      else chatDrafts.clearDraft(activeConvId);
    }
    setActiveConvId(convId); setActiveGroupId(null); setActiveGroupInfo(null);
    setShowMobile('chat'); setAutoAcceptCall(null); resetMessages(); bulkSelect.stopSelecting();
    setShowMessageSearch(false); messageSearch.clear(); threadReplies.closeThread();
    const conv = conversations.find(c => c.id === convId);
    if (conv) setActiveOtherUserId(conv.otherUserId);
    await loadMessagesInitial(convId);
    trackEvent('conversation_opened', { type: 'dm' });
    if (myUserId) {
      supabase.from('private_messages').update({ is_read: true })
        .eq('conversation_id', convId).neq('sender_id', myUserId).eq('is_read', false).then(() => {});
    }
  }, [conversations, loadMessagesInitial, resetMessages, myUserId, bulkSelect, trackEvent, activeConvId, chatDrafts, messageSearch, threadReplies]);

  const handleSelectGroup = useCallback((groupId: string) => {
    if (!isValidUUID(groupId)) return;
    if (activeGroupId) {
      const input = document.querySelector('.mensajes-input-text') as HTMLInputElement | null;
      if (input?.value?.trim()) chatDrafts.setDraft(activeGroupId, input.value);
      else chatDrafts.clearDraft(activeGroupId);
    }
    setActiveGroupId(groupId); setActiveConvId(null); setActiveOtherUserId(null);
    setShowMobile('chat'); setAutoAcceptCall(null); setGroupMessages([]); bulkSelect.stopSelecting();
    setShowMessageSearch(false); messageSearch.clear(); threadReplies.closeThread();
    loadGroupMessages(groupId); trackEvent('conversation_opened', { type: 'group' });
  }, [loadGroupMessages, bulkSelect, trackEvent, activeGroupId, chatDrafts, messageSearch, threadReplies]);

  const handleBack = useCallback(() => {
    const scopeId = activeConvId || activeGroupId;
    if (scopeId) {
      const input = document.querySelector('.mensajes-input-text') as HTMLInputElement | null;
      if (input?.value?.trim()) chatDrafts.setDraft(scopeId, input.value);
      else chatDrafts.clearDraft(scopeId);
    }
    setActiveConvId(null); setActiveGroupId(null); setActiveOtherUserId(null);
    setActiveGroupInfo(null); setShowMobile('sidebar'); setAutoAcceptCall(null); bulkSelect.stopSelecting();
    setShowMessageSearch(false); messageSearch.clear(); threadReplies.closeThread();
  }, [bulkSelect, activeConvId, activeGroupId, chatDrafts, messageSearch, threadReplies]);

  // ──────────────────────────────
  // SEND MESSAGE
  // ──────────────────────────────

  const handleSendMessage = useCallback(async (
    content: string, mediaUrl?: string, mediaType?: string, replyTo?: string, isForwarded?: boolean
  ) => {
    if (!myUserId || !activeConvId || !activeOtherUserId) return;
    const convId = activeConvId; const receiverId = activeOtherUserId;
    chatDrafts.clearDraft(convId);
    const tempId = `temp-${Date.now()}`;
    deliveryStatus.markSending(tempId);
    let finalContent = content || ''; let iv: string | null = null;
    const isLocation = mediaType === 'location';
    const isPaymentRequest = finalContent.startsWith('[PAYMENT_REQUEST:');
    if (finalContent && activeOtherUserId && e2ee.isReady && !isLocation && !isPaymentRequest) {
      try {
        const encrypted = await e2ee.encrypt(finalContent, activeOtherUserId);
        if (encrypted) { finalContent = encrypted.ciphertext; iv = encrypted.iv; }
      } catch (err) {
        console.error('[E2EE] encryption error:', err);
      }
    }
    const expiresAt = disappearing.getExpiresAt(disappearing.timer);
    const insertPayload: Record<string, unknown> = {
      chat_id: convId, conversation_id: convId, sender_id: myUserId, receiver_id: receiverId,
      content: finalContent,
      media_url: mediaUrl || null, media_type: mediaType || null, is_read: false,
      reply_to: replyTo || null, is_forwarded: isForwarded === true,
    };
    if (expiresAt) insertPayload.expires_at = expiresAt;
    if (iv) insertPayload.iv = iv;
    const { data: insertedMsg, error } = await supabase.from('private_messages').insert(insertPayload as never).select('id').single();
    if (error) { toast.error('Error al enviar'); deliveryStatus.markFailed(tempId); return; }
    if (insertedMsg) deliveryStatus.markSent(String((insertedMsg as Record<string, unknown>).id));
    processAutoResponse(convId, myUserId, content).catch(() => {});
    await supabase.from('conversations').update({
      last_message: isLocation ? '\uD83D\uDCCD Ubicacion' : (content || '\uD83D\uDCCE Archivo'),
      last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', convId);
    const notifyChannel = supabase.channel(`msg-notify-send:${receiverId}:${Date.now()}`);
    notifyChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        notifyChannel.send({
          type: 'broadcast', event: 'new-message',
          payload: { to: receiverId, from: myUserId, fromName: str(myProfile?.full_name, 'Usuario'),
            preview: content ? content.slice(0, 100) : '\uD83D\uDCE9 Nuevo mensaje', conversationId: convId, avatarUrl: myProfile?.avatar_url || null },
        });
        setTimeout(() => supabase.removeChannel(notifyChannel), 3_000);
      }
    });
    sendPushNotification({
      targetUserId: receiverId, type: 'message', title: str(myProfile?.full_name, 'Usuario'),
      body: content ? content.slice(0, 100) : '\uD83D\uDCE9 Nuevo mensaje', fromUserId: myUserId,
      conversationId: convId, avatarUrl: myProfile?.avatar_url || null,
    }).catch(() => {});
    trackEvent('message_sent', { type: mediaType || 'text', hasReply: !!replyTo, isForwarded: !!isForwarded, encrypted: !!iv });
  }, [myUserId, activeConvId, activeOtherUserId, e2ee, disappearing, trackEvent, myProfile, chatDrafts, deliveryStatus]);

  const handleSendGroupMessage = useCallback(async (content: string, mediaUrl?: string, mediaType?: string) => {
    if (!myUserId || !activeGroupId) return;
    const gId = activeGroupId;
    chatDrafts.clearDraft(gId);
    const mentionedUsernames = mentions.extractMentions(content);
    const isGroupLocation = mediaType === 'location';
    const insertObj: Record<string, unknown> = { group_id: gId, sender_id: myUserId, content: content || '' };
    if (mediaUrl) { insertObj.media_url = mediaUrl; insertObj.media_type = mediaType ?? null; }
    if (isGroupLocation) { insertObj.media_type = 'location'; }
    const { error } = await supabase.from('group_messages').insert(insertObj as never);
    if (error) { toast.error('Error al enviar'); return; }
    await supabase.from('groups').update({
      last_message: isGroupLocation ? '\uD83D\uDCCD Ubicacion' : (content || '\uD83D\uDCCE Archivo'),
      last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', gId);
    const { data: membersData } = await supabase.from('group_members')
      .select('user_id').eq('group_id', gId).neq('user_id', myUserId);
    if (membersData) {
      const groupName = activeGroupInfo?.name || 'Grupo';
      for (const member of membersData) {
        sendPushNotification({
          targetUserId: member.user_id, type: 'message', title: groupName,
          body: `${str(myProfile?.full_name, 'Usuario')}: ${content ? content.slice(0, 80) : '\uD83D\uDCE9 Nuevo mensaje'}`,
          fromUserId: myUserId, avatarUrl: myProfile?.avatar_url || null,
        }).catch(() => {});
      }
    }
    trackEvent('message_sent', { type: mediaType || 'text', group: true, mentions: mentionedUsernames.length });
  }, [myUserId, activeGroupId, activeGroupInfo, trackEvent, myProfile, chatDrafts, mentions]);

     // ──────────────────────────────
  // START CONVERSATION / CREATE GROUP
  // ──────────────────────────────

  const handleStartConversation = useCallback(async (otherUserId: string) => {
    if (!myUserId || !isValidUUID(otherUserId)) { toast.error('ID de usuario invalido'); return; }
    try {
      const { data: existing } = await supabase.from('conversations').select('id')
        .or(`and(user_1.eq.${myUserId},user_2.eq.${otherUserId}),and(user_1.eq.${otherUserId},user_2.eq.${myUserId})`)
        .maybeSingle();
      if (existing?.id) { handleSelectConversation(existing.id); setShowNewChat(false); search.clear(); return; }
      const { data: newConv, error } = await supabase.from('conversations')
        .insert({ user_1: myUserId, user_2: otherUserId, last_message: null, last_message_at: new Date().toISOString() })
        .select('id').single();
      if (error || !newConv) { toast.error('Error al crear chat'); return; }
      setShowNewChat(false); search.clear();
            await reloadConversations(); if (newConv.id) handleSelectConversation(newConv.id);
    } catch (err) {
      console.error('[Mensajes] start conversation error:', err);
      toast.error('Error al iniciar conversacion');
    }
  }, [myUserId, handleSelectConversation, reloadConversations, search]);

  useEffect(() => {
    const targetId = locState.contactUserId;
    if (!targetId || !myUserId || targetId === myUserId) return;
    if (!isValidUUID(targetId)) return;
    const safeUserId: string = myUserId;
    const safeTargetId: string = targetId;
    (async () => {
      try {
        const convId = await findOrCreateConversation(safeUserId, safeTargetId);
        if (convId) {
          await reloadConversations();
          handleSelectConversation(convId);
        }
      } catch (err) {
        console.error('[Mensajes] Auto-open DM error:', err);
      }
    })();
  }, [locState.contactUserId, myUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateGroup = useCallback(async () => {
    if (!myUserId) return;
    const trimmedName = newGroupName.trim().slice(0, MAX_GROUP_NAME_LENGTH);
    if (!trimmedName) { toast.error('Nombre requerido'); return; }
    try {
      const insertData: Record<string, unknown> = {
        name: trimmedName, description: newGroupDesc.trim().slice(0, MAX_GROUP_DESC_LENGTH) || null,
        created_by: myUserId, last_message_at: new Date().toISOString(),
      };
      if (newGroupAvatar) insertData.avatar_url = newGroupAvatar;
      const { data: newGroup, error } = await supabase.from('groups').insert(insertData as never).select('id').single();
      if (error || !newGroup) { toast.error('Error al crear grupo'); return; }
      await supabase.from('group_members').insert({ group_id: newGroup.id, user_id: myUserId, role: 'owner' });
      setShowNewGroup(false); setNewGroupName(''); setNewGroupDesc(''); setNewGroupAvatar(null);
      await reloadGroups(); handleSelectGroup(newGroup.id); toast.success('Grupo creado');
    } catch (err) {
      console.error('[Groups] create error:', err);
      toast.error('Error al crear grupo');
    }
  }, [myUserId, newGroupName, newGroupDesc, newGroupAvatar, reloadGroups, handleSelectGroup]);

  const handleAddMemberToGroup = useCallback(async (userId: string) => {
    if (!activeGroupId || !isValidUUID(userId)) return;
    const gId = activeGroupId;
    try {
      const { error } = await supabase.from('group_members').insert({ group_id: gId, user_id: userId, role: 'member' });
      if (error) { if (error.code === '23505') toast.error('Ya es miembro'); else toast.error('Error al agregar'); return; }
      toast.success('Miembro agregado'); setShowAddMember(false); search.clear(); loadGroupMessages(gId);
    } catch (err) {
      console.error('[Groups] add member error:', err);
      toast.error('Error al agregar miembro');
    }
  }, [activeGroupId, loadGroupMessages, search]); 
   // ──────────────────────────────
  // BLOCK / REPORT / MUTE / DELETE
  // ──────────────────────────────

  const handleBlock = useCallback(async () => {
    if (!myUserId || !activeOtherUserId) return;
    const targetId = activeOtherUserId;
    try {
      if (blockedIds.has(targetId)) {
        const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', myUserId).eq('blocked_id', targetId);
        if (error) { toast.error('Error al desbloquear'); return; }
        setBlockedIds(prev => { const next = new Set(prev); next.delete(targetId); return next; }); toast.success('Desbloqueado');
      } else {
        const { error } = await supabase.from('blocked_users').insert({ blocker_id: myUserId, blocked_id: targetId });
        if (error) { toast.error('Error al bloquear'); return; }
        setBlockedIds(prev => new Set(prev).add(targetId)); toast.success('Bloqueado');
      }
    } catch (err) {
      console.error('[Block] error:', err);
      toast.error('Error de bloqueo');
    }
  }, [myUserId, activeOtherUserId, blockedIds]);

  const handleReport = useCallback(async (category: string, reason: string) => {
    if (!myUserId || !activeOtherUserId) return;
    if (!reportRateLimiter()) { toast.error('Espera antes de reportar de nuevo'); return; }
    const targetId = activeOtherUserId;
    const safeCategory = sanitizeReportCategory(category);
    const safeReason = (reason || '').trim().slice(0, 500);

    try {
      await untypedFrom('reported_users').insert({ reporter_id: myUserId, reported_id: targetId, reason: '[' + safeCategory + '] ' + safeReason, status: 'pending' });
      try { await supabase.from('blocked_users').insert({ blocker_id: myUserId, blocked_id: targetId }); } catch { /* may already be blocked */ }
      setBlockedIds(prev => new Set(prev).add(targetId));

      const { data: reportedProfile } = await supabase.from('profiles').select('full_name, username, avatar_url').eq('id', targetId).single();
      const rp = reportedProfile as Record<string, unknown> | null;
      const reportedName = str(rp?.full_name as string | null, str(rp?.username as string | null, 'Usuario'));

      const contactIds = new Set<string>();
      const { data: convs1 } = await supabase.from('conversations').select('user_1, user_2').eq('user_1', targetId);
      const { data: convs2 } = await supabase.from('conversations').select('user_1, user_2').eq('user_2', targetId);
      (convs1 || []).forEach((c: Record<string, unknown>) => { if (c.user_2 !== myUserId) contactIds.add(c.user_2 as string); });
      (convs2 || []).forEach((c: Record<string, unknown>) => { if (c.user_1 !== myUserId) contactIds.add(c.user_1 as string); });

      const { data: targetGroups } = await supabase.from('group_members').select('group_id').eq('user_id', targetId);
      if (targetGroups && targetGroups.length > 0) {
        const gIds = targetGroups.map((g: Record<string, unknown>) => g.group_id as string);
        const { data: sharedMembers } = await supabase.from('group_members').select('user_id').in('group_id', gIds);
        (sharedMembers || []).forEach((mm: Record<string, unknown>) => { if (mm.user_id !== myUserId && mm.user_id !== targetId) contactIds.add(mm.user_id as string); });
      }

      const { data: allReports } = await untypedFrom('reported_users').select('id').eq('reported_id', targetId);
      const totalReports = (allReports || []).length;

      const alertPayload = { type: 'user_reported', reportedUserId: targetId, reportedName, reportedAvatar: rp?.avatar_url || null, reportedUsername: rp?.username || null, category: safeCategory, totalReports };

      for (const cid of contactIds) {
        const ch = supabase.channel('report-alert:' + cid + ':' + Date.now());
        ch.subscribe((st: string) => {
          if (st === 'SUBSCRIBED') {
            ch.send({ type: 'broadcast', event: 'report-alert', payload: { ...alertPayload, to: cid } });
            setTimeout(() => supabase.removeChannel(ch), 3000);
          }
        });
        sendPushNotification({ targetUserId: cid, type: 'message', title: 'Alerta de seguridad', body: reportedName + ' ha sido reportado. ' + totalReports + ' reporte(s).', fromUserId: myUserId, avatarUrl: null }).catch(() => {});
      }

      if (totalReports >= 3) {
        try { await untypedFrom('profiles').update({ is_banned: true }).eq('id', targetId); } catch { /* best-effort ban */ }
        try { await supabase.from('group_members').delete().eq('user_id', targetId); } catch { /* best-effort removal */ }
      }

      setReportDialog({ open: false, userName: '' });
      toast.success('Reportado y bloqueado. ' + contactIds.size + ' contactos alertados.');
      trackEvent('user_reported', { category: safeCategory, contacts_alerted: contactIds.size, total_reports: totalReports });
    } catch (err) {
      console.error('[Report] error:', err);
      toast.error('Error al reportar usuario');
    }
  }, [myUserId, activeOtherUserId, trackEvent, reportRateLimiter]);

  const handleMute = useCallback(async () => {
    if (!activeConvId) return;
    const convId = activeConvId;
    try {
      const newStatus = mutedIds.has(convId) ? 'active' : 'muted';
      const { error } = await supabase.from('conversations').update({ status: newStatus }).eq('id', convId);
      if (error) { toast.error('Error al cambiar silencio'); return; }
      setMutedIds(prev => { const next = new Set(prev); if (newStatus === 'muted') next.add(convId); else next.delete(convId); return next; });
      toast.success(newStatus === 'muted' ? 'Silenciado' : 'Notificaciones activadas');
    } catch (err) {
      console.error('[Mute] error:', err);
      toast.error('Error al silenciar');
    }
  }, [activeConvId, mutedIds]);

  const handleDeleteChat = useCallback(() => {
    if (!activeConvId) return;
    const convId = activeConvId;
    setConfirmDialog({
      open: true, title: 'Eliminar conversacion',
      description: 'Se eliminaran todos los mensajes de esta conversacion. Esta accion no se puede deshacer.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await supabase.from('private_messages').delete().eq('conversation_id', convId);
          await supabase.from('conversations').delete().eq('id', convId);
          setActiveConvId(null); setActiveOtherUserId(null); setMessages([]); setShowMobile('sidebar');
          chatDrafts.clearDraft(convId);
          reloadConversations(); toast.success('Eliminado');
        } catch (err) { console.error('[Delete] chat error:', err); toast.error('Error al eliminar'); }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [activeConvId, reloadConversations, setMessages, chatDrafts]);

  const handleClearConversation = useCallback(async (convId: string) => {
    if (!isValidUUID(convId)) return;
    setConfirmDialog({
      open: true, title: 'Limpiar chat',
      description: 'Se eliminaran todos los mensajes pero el chat se mantendra.',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await supabase.from('private_messages').delete().eq('conversation_id', convId);
          await supabase.from('conversations').update({ last_message: null, last_message_at: new Date().toISOString() }).eq('id', convId);
          if (activeConvId === convId) setMessages([]);
          reloadConversations(); toast.success('Chat limpiado');
        } catch (err) { console.error('[Clear] conversation error:', err); toast.error('Error al limpiar chat'); }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [activeConvId, reloadConversations, setMessages]);

  const handleDeleteConversationFromSidebar = useCallback(async (convId: string) => {
    if (!isValidUUID(convId)) return;
    setConfirmDialog({
      open: true, title: 'Eliminar conversacion',
      description: 'Se eliminara la conversacion y todos los mensajes permanentemente.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await supabase.from('private_messages').delete().eq('conversation_id', convId);
          await supabase.from('conversations').delete().eq('id', convId);
          if (activeConvId === convId) { setActiveConvId(null); setActiveOtherUserId(null); setMessages([]); setShowMobile('sidebar'); }
          chatDrafts.clearDraft(convId);
          reloadConversations(); toast.success('Conversacion eliminada');
        } catch (err) { console.error('[Delete] sidebar conversation error:', err); toast.error('Error al eliminar'); }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [activeConvId, reloadConversations, setMessages, chatDrafts]);

  const handleClearGroup = useCallback(async (groupId: string) => {
    if (!isValidUUID(groupId)) return;
    setConfirmDialog({
      open: true, title: 'Limpiar grupo',
      description: 'Se eliminaran todos los mensajes pero el grupo se mantendra.',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await supabase.from('group_messages').delete().eq('group_id', groupId);
          await supabase.from('groups').update({ last_message: null, last_message_at: new Date().toISOString() }).eq('id', groupId);
          if (activeGroupId === groupId) setGroupMessages([]);
          reloadGroups(); toast.success('Grupo limpiado');
        } catch (err) { console.error('[Clear] group error:', err); toast.error('Error al limpiar grupo'); }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [activeGroupId, reloadGroups]);

  const handleDeleteGroupFromSidebar = useCallback(async (groupId: string) => {
    if (!isValidUUID(groupId)) return;
    setConfirmDialog({
      open: true, title: 'Eliminar grupo',
      description: 'Se eliminara el grupo y todos sus mensajes permanentemente.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await supabase.from('group_messages').delete().eq('group_id', groupId);
          await supabase.from('group_members').delete().eq('group_id', groupId);
          await supabase.from('groups').delete().eq('id', groupId);
          if (activeGroupId === groupId) { setActiveGroupId(null); setActiveGroupInfo(null); setShowMobile('sidebar'); }
          chatDrafts.clearDraft(groupId);
          reloadGroups(); toast.success('Grupo eliminado');
        } catch (err) { console.error('[Delete] sidebar group error:', err); toast.error('Error al eliminar grupo'); }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [activeGroupId, reloadGroups, chatDrafts]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!activeGroupId || !isValidUUID(userId)) return;
    const gId = activeGroupId;
    setConfirmDialog({
      open: true, title: 'Expulsar miembro', description: 'Este usuario sera removido del grupo.', variant: 'warning',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('group_members').delete().eq('group_id', gId).eq('user_id', userId);
          if (error) { toast.error('Error al expulsar: ' + error.message); } else { toast.success('Miembro expulsado'); }
          loadGroupMessages(gId);
        } catch (err) { console.error('[Groups] remove member error:', err); toast.error('Error al expulsar'); }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [activeGroupId, loadGroupMessages]);

  const handlePromoteMember = useCallback(async (userId: string, role: 'admin' | 'moderator' | 'member') => {
    if (!activeGroupId || !isValidUUID(userId)) return;
    if (!promoteRateLimiter()) { toast.error('Espera antes de cambiar rol de nuevo'); return; }
    const gId = activeGroupId;
    try {
      const { error } = await supabase.from('group_members')
        .update({ role })
        .eq('group_id', gId)
        .eq('user_id', userId);
      if (error) {
        console.error('[Groups] promote error:', error.message, error.code, error.details);
        toast.error('Error al cambiar rol: ' + (error.message || 'desconocido'));
        return;
      }
      toast.success(
        role === 'admin' ? 'Promovido a admin'
        : role === 'moderator' ? 'Promovido a moderador'
        : 'Rol removido'
      );
      loadGroupMessages(gId);
    } catch (err) {
      console.error('[Groups] promote critical error:', err);
      toast.error('Error al cambiar rol');
    }
  }, [activeGroupId, loadGroupMessages, promoteRateLimiter]);

  const handleLeaveGroup = useCallback(() => {
    if (!activeGroupId || !myUserId) return;
    const gId = activeGroupId;
    setConfirmDialog({
      open: true, title: 'Salir del grupo', description: 'Dejaras de recibir mensajes de este grupo.', variant: 'warning',
      onConfirm: async () => {
        try {
          await supabase.from('group_members').delete().eq('group_id', gId).eq('user_id', myUserId);
          setActiveGroupId(null); setActiveGroupInfo(null); setShowMobile('sidebar');
          chatDrafts.clearDraft(gId);
          reloadGroups(); toast.success('Has salido del grupo');
        } catch (err) { console.error('[Groups] leave error:', err); toast.error('Error al salir del grupo'); }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [activeGroupId, myUserId, reloadGroups, chatDrafts]);

  const handleDeleteGroup = useCallback(() => {
    if (!activeGroupId) return;
    const gId = activeGroupId;
    setConfirmDialog({
      open: true, title: 'Eliminar grupo',
      description: 'Se eliminara el grupo y todos sus mensajes permanentemente.', variant: 'danger',
      onConfirm: async () => {
        try {
          await supabase.from('group_messages').delete().eq('group_id', gId);
          await supabase.from('group_members').delete().eq('group_id', gId);
          await supabase.from('groups').delete().eq('id', gId);
          setActiveGroupId(null); setActiveGroupInfo(null); setShowMobile('sidebar');
          chatDrafts.clearDraft(gId);
          reloadGroups(); toast.success('Grupo eliminado');
        } catch (err) { console.error('[Groups] delete error:', err); toast.error('Error al eliminar grupo'); }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [activeGroupId, reloadGroups, chatDrafts]);

  const handleEditGroup = useCallback(async (name: string, description: string) => {
    if (!activeGroupId) return;
    try {
      const { error } = await supabase.from('groups').update({
        name: name.slice(0, MAX_GROUP_NAME_LENGTH),
        description: description.slice(0, MAX_GROUP_DESC_LENGTH),
        updated_at: new Date().toISOString(),
      }).eq('id', activeGroupId);
      if (error) { toast.error('Error al editar grupo: ' + error.message); return; }
      loadGroupMessages(activeGroupId);
    } catch (err) { console.error('[Groups] edit error:', err); toast.error('Error al editar'); }
  }, [activeGroupId, loadGroupMessages]);

  const handleEditGroupAvatar = useCallback(async (avatarUrl: string) => {
    if (!activeGroupId) return;
    try {
      await supabase.from('groups').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() } as never).eq('id', activeGroupId);
      setActiveGroupInfo(prev => prev ? { ...prev, avatarUrl } as GroupInfo : null);
      toast.success('Avatar de grupo actualizado');
    } catch (err) { console.error('[Groups] avatar edit error:', err); toast.error('Error al actualizar avatar'); }
  }, [activeGroupId]);

  const handleForwardToDm = useCallback(async (targetConvId: string) => {
    if (!myUserId || !forwardingMessage || !isValidUUID(targetConvId)) return;
    try {
      const fwdIsLocation = forwardingMessage.mediaType === 'location' || (() => { try { const p = JSON.parse(forwardingMessage.content); return typeof p.lat === 'number' && typeof p.lng === 'number'; } catch { return false; } })();
      // Look up the conversation to determine receiver_id
      const { data: convData } = await supabase.from('conversations').select('user_1, user_2').eq('id', targetConvId).single();
const rawReceiver = convData ? (convData.user_1 === myUserId ? convData.user_2 : convData.user_1) : null;
const fwdReceiverId: string = rawReceiver ?? myUserId ?? '';
      const fwdPayload: Record<string, unknown> = {
        chat_id: targetConvId, conversation_id: targetConvId, sender_id: myUserId,
        receiver_id: fwdReceiverId,
        content: forwardingMessage.content || '',
        media_url: forwardingMessage.mediaUrl ?? null, media_type: fwdIsLocation ? 'location' : (forwardingMessage.mediaType ?? null),
        is_read: false, is_forwarded: true, reply_to: null,
      };
      const { error } = await supabase.from('private_messages').insert(fwdPayload as never);
      if (error) { toast.error('Error al reenviar'); return; }
      await supabase.from('conversations').update({
        last_message: fwdIsLocation ? '\u21AA \uD83D\uDCCD Ubicacion' : '\u21AA ' + (forwardingMessage.content || '\uD83D\uDCCE Archivo'), last_message_at: new Date().toISOString(),
      }).eq('id', targetConvId);
      setForwardingMessage(null); toast.success('Mensaje reenviado');
    } catch (err) { console.error('[Forward] DM error:', err); toast.error('Error al reenviar'); }
  }, [myUserId, forwardingMessage]);

  const handleForwardToGroup = useCallback(async (targetGroupId: string) => {
    if (!myUserId || !forwardingMessage || !isValidUUID(targetGroupId)) return;
    try {
      const fwdIsLocation = forwardingMessage.mediaType === 'location' || (() => { try { const p = JSON.parse(forwardingMessage.content); return typeof p.lat === 'number' && typeof p.lng === 'number'; } catch { return false; } })();
      const fwdObj: Record<string, unknown> = { group_id: targetGroupId, sender_id: myUserId, content: forwardingMessage.content || '' };
      if (forwardingMessage.mediaUrl) { fwdObj.media_url = forwardingMessage.mediaUrl; fwdObj.media_type = fwdIsLocation ? 'location' : (forwardingMessage.mediaType ?? null); }
      if (fwdIsLocation && !forwardingMessage.mediaUrl) { fwdObj.media_type = 'location'; }
      const { error } = await supabase.from('group_messages').insert(fwdObj as never);
      if (error) { toast.error('Error al reenviar'); return; }
      await supabase.from('groups').update({
        last_message: fwdIsLocation ? '\u21AA \uD83D\uDCCD Ubicacion' : '\u21AA ' + (forwardingMessage.content || '\uD83D\uDCCE Archivo'), last_message_at: new Date().toISOString(),
      }).eq('id', targetGroupId);
      setForwardingMessage(null); toast.success('Reenviado al grupo');
    } catch (err) { console.error('[Forward] group error:', err); toast.error('Error al reenviar'); }
  }, [myUserId, forwardingMessage]);

  const handleCall = useCallback((type: 'audio' | 'video') => { trackEvent('call_started', { type }); }, [trackEvent]);

  // ──────────────────────────────
  // v8 HANDLERS
  // ──────────────────────────────

  const handleArchiveConversation = useCallback(() => {
    if (!activeConvId) return;
    const isArch = archivedChats.isArchived(activeConvId, 'conv');
    if (isArch) archivedChats.unarchiveConversation(activeConvId);
    else archivedChats.archiveConversation(activeConvId);
  }, [activeConvId, archivedChats]);

  const handleArchiveGroup = useCallback(() => {
    if (!activeGroupId) return;
    const isArch = archivedChats.isArchived(activeGroupId, 'group');
    if (isArch) archivedChats.unarchiveGroup(activeGroupId);
    else archivedChats.archiveGroup(activeGroupId);
  }, [activeGroupId, archivedChats]);

  const handleExportChat = useCallback((format: 'txt' | 'json' | 'csv') => {
    if (activeConvId) {
      const otherName = str(getProfile(activeOtherUserId ?? '')?.full_name, 'Chat');
      chatExport.exportChat('conversation', activeConvId, otherName, format);
    } else if (activeGroupId) {
      chatExport.exportChat('group', activeGroupId, activeGroupInfo?.name || 'Grupo', format);
    }
  }, [activeConvId, activeGroupId, activeGroupInfo, activeOtherUserId, chatExport, getProfile]);

  const handleJumpToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.background = 'rgba(29, 78, 216, 0.12)';
      setTimeout(() => { el.style.background = ''; }, 2000);
    }
  }, []);

  const activeOtherProfile = useMemo(() => {
    if (!activeOtherUserId) return null;
    return getProfile(activeOtherUserId) || profilesRef.current.get(activeOtherUserId) || null;
  }, [activeOtherUserId, getProfile, conversations]);

  const activeWallpaper = useMemo(() => {
    const scopeId = activeConvId || activeGroupId;
    return scopeId ? chatWallpaper.getWallpaper(scopeId) : null;
  }, [activeConvId, activeGroupId, chatWallpaper]);

  const visibleConversations = useMemo(() =>
    archivedChats.showArchived ? conversations : conversations.filter(c => !archivedChats.isArchived(c.id, 'conv')),
    [conversations, archivedChats]
  );
  const visibleGroups = useMemo(() =>
    archivedChats.showArchived ? groups : groups.filter(g => !archivedChats.isArchived(g.id, 'group')),
    [groups, archivedChats]
  );

  // ──────────────────────────────
  // RENDER
  // ──────────────────────────────

  if (!user || !myProfile) {
    return (
      <div className="mensajes-container">
        <div className="mensajes-main-empty">
          <div className="mensajes-main-empty-icon"><MessageCircle size={36} style={{ color: MC.blue }} /></div>
          <h2>Cargando...</h2>
        </div>
      </div>
    );
  }

  if (chatLock.isLocked) {
    return <ChatLockScreen mode="unlock" onUnlock={chatLock.unlock} />;
  }
  if (chatLock.showSetup) {
    return <ChatLockScreen mode="setup" onUnlock={chatLock.unlock} onSetup={(pin) => chatLock.setupPin(pin)} />;
  }

  return (
    <div className="mensajes-container">

      <ChatSidebar
        className={showMobile === 'chat' ? 'hidden-mobile' : ''}
        currentUser={{ id: myProfile.user_id, fullName: str(myProfile.full_name, 'Usuario'), avatarUrl: myProfile.avatar_url, username: myProfile.username }}
        conversations={visibleConversations}
        groups={visibleGroups}
        activeConversationId={activeConvId ?? activeGroupId ?? null}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSelectConversation={handleSelectConversation}
        onSelectGroup={handleSelectGroup}
        onNewChat={() => setShowNewChat(true)}
        onNewGroup={() => setShowNewGroup(true)}
        onOpenSettings={() => setShowSettings(true)}
        onBack={() => navigate('/home')}
        onDeleteConversation={handleDeleteConversationFromSidebar}
        onClearConversation={handleClearConversation}
        onDeleteGroup={handleDeleteGroupFromSidebar}
        onClearGroup={handleClearGroup}
      />

      {showSettings && myProfile && (
        <SettingsPanel
          profile={myProfile}
          onClose={() => setShowSettings(false)}
          onProfileUpdated={(updated) => setMyProfile(updated)}
          privacySettings={privacySettings}
          chatLock={chatLock}
          blockedIds={blockedIds}
          setBlockedIds={setBlockedIds}
          onTriggerTutorial={triggerTutorial}
        />
      )}

      {showTutorial && <AppTutorial onComplete={dismissTutorial} />}

      {showGroupInviteModal && activeGroupId && activeGroupInfo && (
        <GroupInviteModal
          open={showGroupInviteModal}
          groupId={activeGroupId}
          groupName={activeGroupInfo.name}
          invites={groupInvites.invites}
          loading={groupInvites.loading}
          onGenerateLink={groupInvites.generateInviteLink}
          onRevokeInvite={groupInvites.revokeInvite}
          onRevokeAll={groupInvites.revokeAllInvites}
          onLoadInvites={groupInvites.loadInvites}
          onClose={() => setShowGroupInviteModal(false)}
        />
      )}

      <SharedMediaPanel
        open={showSharedMedia}
        items={sharedMedia.items}
        activeTab={sharedMedia.activeTab}
        loading={sharedMedia.loading}
        scopeType={activeGroupId ? 'group' : 'conversation'}
        scopeId={(activeGroupId || activeConvId) ?? ''}
        onLoadMedia={sharedMedia.loadMedia}
        onClose={() => { setShowSharedMedia(false); sharedMedia.clear(); }}
      />

      {showNewChat && myUserId && (
        <NewChatModal
          userId={myUserId}
          search={search}
          onStartConversation={handleStartConversation}
          onClose={() => setShowNewChat(false)}
          MC={MC}
        />
      )}

      {showNewGroup && (
        <div style={{ position: 'fixed', inset: 0, background: MC.overlay, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: MC.sidebar, borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '20px', border: `1px solid ${MC.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontWeight: 700, fontSize: '16px', color: MC.text }}>Nuevo Grupo</span>
              <button onClick={() => { setShowNewGroup(false); setNewGroupAvatar(null); }} style={{ background: 'none', border: 'none', color: MC.textMuted, cursor: 'pointer', padding: '4px' }}>
                <XIcon size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <GroupAvatarPicker avatarUrl={newGroupAvatar} onAvatarSelected={(url) => setNewGroupAvatar(url)} />
              <div>
                <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '4px', display: 'block' }}>Nombre del grupo *</label>
                <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value.slice(0, MAX_GROUP_NAME_LENGTH))} placeholder="Ej: Amigos CDMX"
                  maxLength={MAX_GROUP_NAME_LENGTH}
                  style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: MC.textMuted, marginBottom: '4px', display: 'block' }}>Descripcion (opcional)</label>
                <textarea value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value.slice(0, MAX_GROUP_DESC_LENGTH))} rows={3} placeholder="Descripcion del grupo..."
                  maxLength={MAX_GROUP_DESC_LENGTH}
                  style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <button onClick={handleCreateGroup} style={{ padding: '10px', background: MC.blue, border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Crear Grupo</button>
            </div>
          </div>
        </div>
      )}

      {showAddMember && (
        <div style={{ position: 'fixed', inset: 0, background: MC.overlay, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: MC.sidebar, borderRadius: '16px', width: '100%', maxWidth: '420px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${MC.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '16px', borderBottom: `1px solid ${MC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '16px', color: MC.text }}>Agregar Miembro</span>
              <button onClick={() => { setShowAddMember(false); search.clear(); }} style={{ background: 'none', border: 'none', color: MC.textMuted, cursor: 'pointer', padding: '4px' }}>
                <XIcon size={18} />
              </button>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <input type="text" placeholder="Buscar usuario..." value={search.query} onChange={(e) => search.setQuery(e.target.value)} autoFocus
                maxLength={MAX_SEARCH_QUERY_LENGTH}
                style={{ width: '100%', padding: '10px 14px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
              {search.results.map((p) => (
                <div key={p.user_id} onClick={() => handleAddMemberToGroup(p.user_id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = MC.sidebarHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: MC.sidebarActive, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: MC.textMuted, overflow: 'hidden' }}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : str(p.full_name, '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: MC.text }}>{str(p.full_name, 'Usuario')}</div>
                    <div style={{ fontSize: '12px', color: MC.textMuted }}>{p.username ? `@${p.username}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ForwardModal open={!!forwardingMessage} messagePreview={forwardingMessage ? (forwardingMessage.mediaType === 'location' ? '\uD83D\uDCCD Ubicacion' : forwardingMessage.mediaUrl ? '\uD83D\uDCCE Archivo' : forwardingMessage.content?.slice(0, 60) || '') : ''}
        conversations={conversations} groups={groups} currentConvId={activeConvId}
        onForwardToDm={handleForwardToDm} onForwardToGroup={handleForwardToGroup} onClose={() => setForwardingMessage(null)} />

      <ConfirmDialog open={confirmDialog.open} title={confirmDialog.title} description={confirmDialog.description}
        variant={confirmDialog.variant} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))} />

      <ReportDialog open={reportDialog.open} userName={reportDialog.userName} onSubmit={(cat: string, reason: string) => handleReport(cat, reason)} onCancel={() => setReportDialog({ open: false, userName: '' })} />

      {activeConvId && (
        <ErrorBoundary>
          <ChatWindow
            currentUserId={myProfile.user_id}
            currentUserName={str(myProfile.full_name, 'Usuario')}
            currentUserAvatar={myProfile.avatar_url}
            otherUser={{
              id: activeOtherProfile?.user_id ?? activeOtherUserId ?? '',
              fullName: str(activeOtherProfile?.full_name, 'Usuario'),
              avatarUrl: activeOtherProfile?.avatar_url ?? null,
              isOnline: bool(activeOtherProfile?.is_online),
              lastSeen: activeOtherProfile?.last_seen ?? null,
            }}
            messages={messages}
            conversationId={activeConvId}
            onSendMessage={handleSendMessage}
            onBack={handleBack}
            onCall={handleCall}
            onBlock={handleBlock}
            onReport={() => setReportDialog({ open: true, userName: str(activeOtherProfile?.full_name, 'Usuario') })}
            onMute={handleMute}
            onDelete={handleDeleteChat}
            onForward={(msg) => setForwardingMessage(msg as Message)}
            onDeleteMessage={(messageId) => {
              setConfirmDialog({
                open: true, title: 'Eliminar mensaje', description: 'Este mensaje se eliminara permanentemente.', variant: 'danger',
                onConfirm: async () => {
                  try {
                    await supabase.from('private_messages').delete().eq('id', messageId);
                    removeDmMessage(messageId); toast.success('Mensaje eliminado');
                  } catch (err) { console.error('[Delete] message error:', err); toast.error('Error al eliminar mensaje'); }
                  setConfirmDialog(prev => ({ ...prev, open: false }));
                },
              });
            }}
            onBulkDelete={(ids) => {
              setConfirmDialog({
                open: true, title: `Eliminar ${ids.size} mensaje${ids.size > 1 ? 's' : ''}`,
                description: 'Los mensajes seleccionados se eliminaran permanentemente.', variant: 'danger',
                onConfirm: async () => {
                  try {
                    for (const id of ids) { await supabase.from('private_messages').delete().eq('id', id); }
                    removeDmMessages(ids); toast.success('Eliminado');
                  } catch (err) { console.error('[Delete] bulk error:', err); toast.error('Error al eliminar mensajes'); }
                  setConfirmDialog(prev => ({ ...prev, open: false }));
                },
              });
            }}
            isEncrypted={e2ee.isReady}
            isMuted={mutedIds.has(activeConvId)}
            isBlocked={activeOtherUserId ? blockedIds.has(activeOtherUserId) : false}
            autoAcceptCall={autoAcceptCall}
            reactions={dmReactions.reactions}
            onToggleReaction={dmReactions.toggleReaction}
            editingMessage={dmEdit.editingMessage}
            onStartEdit={dmEdit.startEditing}
            onCancelEdit={dmEdit.cancelEditing}
            onSaveEdit={dmEdit.saveEdit}
            canEditMessage={dmEdit.canEdit}
            pinnedMessages={dmPinned.pinnedMessages}
            onPinMessage={dmPinned.pinMessage}
            onUnpinMessage={dmPinned.unpinMessage}
            onShowPinned={() => dmPinned.setShowPinnedPanel(true)}
            deliveryStatus={deliveryStatus}
            starredMessages={starredMessages}
            onToggleStar={(msgId, content) => starredMessages.toggleStar(msgId, 'private_messages', content)}
            onArchive={handleArchiveConversation}
            isArchived={archivedChats.isArchived(activeConvId, 'conv')}
            onExport={handleExportChat}
            onOpenSearch={() => setShowMessageSearch(true)}
            onOpenMedia={() => setShowSharedMedia(true)}
            onJumpToMessage={handleJumpToMessage}
            draft={chatDrafts.getDraft(activeConvId)}
            wallpaper={activeWallpaper}
            linkPreview={linkPreview}
            threadReplies={threadReplies}
            onCreateReminder={() => setShowReminderModal(true)}
            onRequestPayment={() => setShowPaymentModal(true)}
            paymentRequests={paymentRequests}
            otherUserName={activeOtherProfile?.full_name || undefined}
            onScheduleSend={activeConvId ? (content, sendAt) => {
              untypedFrom('scheduled_messages').insert({
                user_id: myUserId, content, send_at: sendAt.toISOString(),
                conversation_id: activeConvId, group_id: null,
              })
                .then(() => toast.success('Mensaje programado para ' + sendAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))
                .catch((err: unknown) => { console.error('[Schedule] error:', err); toast.error('Error al programar mensaje'); });
            } : undefined}
          />
        </ErrorBoundary>
      )}

      {showMessageSearch && (activeConvId || activeGroupId) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90 }}>
          <MessageSearchBar
            query={messageSearch.query}
            results={messageSearch.results}
            searching={messageSearch.searching}
            onSearch={(q) => {
              if (activeConvId) messageSearch.debouncedSearch(activeConvId, 'dm', q);
              else if (activeGroupId) messageSearch.debouncedSearch(activeGroupId, 'group', q);
            }}
            onClose={() => { setShowMessageSearch(false); messageSearch.clear(); }}
            onJumpToMessage={handleJumpToMessage}
          />
        </div>
      )}

      {activeConvId && dmPinned.pinnedMessages.length > 0 && !showMessageSearch && (
        <PinnedMessageBar
          pinnedMessages={dmPinned.pinnedMessages}
          onJumpToMessage={handleJumpToMessage}
          onShowAll={() => dmPinned.setShowPinnedPanel(true)}
          onUnpin={dmPinned.unpinMessage}
          canUnpin={true}
        />
      )}

      {activeGroupId && groupPinned.pinnedMessages.length > 0 && !showMessageSearch && (
        <PinnedMessageBar
          pinnedMessages={groupPinned.pinnedMessages}
          onJumpToMessage={handleJumpToMessage}
          onShowAll={() => groupPinned.setShowPinnedPanel(true)}
          onUnpin={groupPinned.unpinMessage}
          canUnpin={myGroupRole === 'owner' || myGroupRole === 'admin'}
        />
      )}

      {activeGroupId && activeGroupInfo && (
        <GroupChatWindow
          currentUserId={myProfile.user_id} group={activeGroupInfo} members={groupMembers} messages={groupMessages}
          onSendMessage={handleSendGroupMessage} onBack={handleBack}
          onAddMember={() => { setShowAddMember(true); search.clear(); }}
          onRemoveMember={handleRemoveMember} onPromoteMember={handlePromoteMember}
          onLeaveGroup={handleLeaveGroup} onDeleteGroup={handleDeleteGroup} onEditGroup={handleEditGroup}
          onEditGroupAvatar={handleEditGroupAvatar}
          myRole={myGroupRole}
          onOpenInvite={() => setShowGroupInviteModal(true)}
          reactions={groupReactions.reactions}
          onToggleReaction={groupReactions.toggleReaction}
          editingMessage={groupEdit.editingMessage}
          onStartEdit={groupEdit.startEditing}
          onCancelEdit={groupEdit.cancelEditing}
          onSaveEdit={groupEdit.saveEdit}
          canEditMessage={groupEdit.canEdit}
          pinnedMessages={groupPinned.pinnedMessages}
          onPinMessage={groupPinned.pinMessage}
          onUnpinMessage={groupPinned.unpinMessage}
          mentions={mentions}
          joinRequests={groupInvites.joinRequests}
          onApproveJoin={groupInvites.approveJoinRequest}
          onRejectJoin={groupInvites.rejectJoinRequest}
          starredMessages={starredMessages}
          onToggleStar={(msgId, content) => starredMessages.toggleStar(msgId, 'group_messages', content)}
          isGroupMuted={groupMute.isGroupMuted(activeGroupId)}
          onMuteGroup={(duration) => groupMute.muteGroup(activeGroupId, duration)}
          onArchive={handleArchiveGroup}
          isArchived={archivedChats.isArchived(activeGroupId, 'group')}
          onExport={handleExportChat}
          onOpenSearch={() => setShowMessageSearch(true)}
          onOpenMedia={() => setShowSharedMedia(true)}
          onJumpToMessage={handleJumpToMessage}
          draft={chatDrafts.getDraft(activeGroupId)}
          wallpaper={activeWallpaper}
          linkPreview={linkPreview}
          threadReplies={threadReplies}
        />
      )}

      {activeGroupId && (myGroupRole === 'owner' || myGroupRole === 'admin') && groupInvites.joinRequests.length > 0 && (
        <div style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 80, maxWidth: '360px' }}>
          <GroupJoinRequestsPanel
            requests={groupInvites.joinRequests}
            onApprove={groupInvites.approveJoinRequest}
            onReject={groupInvites.rejectJoinRequest}
          />
        </div>
      )}

      <ReminderAlert
        reminder={reminders.activeAlert}
        onDismiss={reminders.dismissReminder}
        onSnooze={reminders.snoozeReminder}
        onGoToChat={(convId, groupId) => {
          if (convId) handleSelectConversation(convId);
          else if (groupId) handleSelectGroup(groupId);
        }}
      />

      <PaymentRequestModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onCreate={async (amount, description) => {
          try {
            const req = await paymentRequests.createRequest({
              amount,
              description,
              payerId: activeOtherUserId || undefined,
              conversationId: activeConvId || undefined,
              groupId: activeGroupId || undefined,
            });
            if (req && activeConvId) {
              await handleSendMessage('[PAYMENT_REQUEST:' + req.id + ':' + amount + ':MXN:' + myUserId + ':' + (description || '') + ']');
            }
          } catch (err) {
            console.error('[Payment] create request error:', err);
            toast.error('Error al crear solicitud de pago');
          }
        }}
        recipientName={activeOtherProfile?.full_name || undefined}
      />

      {(activeConvId || activeGroupId) && (
        <WallpaperPicker
          open={showWallpaperPicker}
          onClose={() => setShowWallpaperPicker(false)}
          currentValue={chatWallpaper.getWallpaper(activeConvId || activeGroupId || '')}
          onSelect={(v) => { chatWallpaper.setWallpaper(activeConvId || activeGroupId || '', v); setShowWallpaperPicker(false); }}
          onRemove={() => { chatWallpaper.removeWallpaper(activeConvId || activeGroupId || ''); setShowWallpaperPicker(false); }}
        />
      )}

      <ReminderModal
        open={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        onCreate={(opts) => reminders.createReminder({
          ...opts,
          conversationId: activeConvId || undefined,
          groupId: activeGroupId || undefined,
        })}
        chatName={activeOtherProfile?.full_name || activeGroupInfo?.name || undefined}
      />

      {!activeConvId && !activeGroupId && (
        <div className={`mensajes-main ${showMobile === 'sidebar' ? 'hidden-mobile' : ''}`}>
          <div className="mensajes-main-empty">
            <div className="mensajes-main-empty-icon"><MessageCircle size={40} /></div>
            <h2>MexiChat</h2>
            <p>Selecciona un chat o inicia uno nuevo</p>
            {archivedChats.archivedConvIds.size + archivedChats.archivedGroupIds.size > 0 && (
              <button
                onClick={() => archivedChats.setShowArchived(!archivedChats.showArchived)}
                style={{ marginTop: '12px', padding: '8px 16px', background: MC.inputBg, border: `1px solid ${MC.border}`, borderRadius: '8px', color: MC.textMuted, fontSize: '13px', cursor: 'pointer' }}
              >
                {archivedChats.showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedChats.archivedConvIds.size + archivedChats.archivedGroupIds.size})`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Mensajes;