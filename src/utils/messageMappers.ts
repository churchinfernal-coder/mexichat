/**
 * MEXICHAT — Message Mappers
 * Single source of truth for DB row → app type mapping
 * Imported by: useMessagePagination, useRealtimeMessages, Mensajes.tsx, GroupChatWindow.tsx
 */

// ─── Shared role type ───

export type GroupRole = 'owner' | 'admin' | 'moderator' | 'member';

const VALID_ROLES = new Set<GroupRole>(['owner', 'admin', 'moderator', 'member']);

/** Safely coerce any DB string to a valid GroupRole, defaulting to 'member' */
export function safeRole(raw: unknown): GroupRole {
  if (typeof raw === 'string' && VALID_ROLES.has(raw as GroupRole)) return raw as GroupRole;
  return 'member';
}

// ─── Core interfaces ───

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
  expiresAt: string | null;
  iv: string | null;
}

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
  expiresAt: string | null;
  iv: string | null;
}

export interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  is_online: boolean | null;
  last_seen: string | null;
  phone: string | null;
  public_key: string | null;
}

export interface ConversationItem {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  otherUserOnline: boolean;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: string;
  disappearTimer: string;
}

export interface GroupItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  memberCount: number;
  disappearTimer: string;
}

export interface GroupMember {
  userId: string;
  fullName: string;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  isOnline: boolean;
  role: GroupRole;
}

export interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  inviteCode: string | null;
  createdBy: string;
  disappearTimer: string;
}

// ─── Safe extractors ───

export function str(val: string | null | undefined, fallback = ''): string {
  return val ?? fallback;
}

export function bool(val: boolean | null | undefined): boolean {
  return val ?? false;
}

export function ts(val: string | null | undefined): string {
  return val ?? new Date().toISOString();
}

// ─── DM Message Mapper ───

export function mapDmMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    senderId: row.sender_id as string,
    content: str(row.content as string | null),
    mediaUrl: (row.media_url as string | null) ?? null,
    mediaType: (row.media_type as string | null) ?? null,
    isRead: bool(row.is_read as boolean | null),
    createdAt: ts(row.created_at as string | null),
    replyTo: (row.reply_to as string | null) ?? null,
    isForwarded: bool(row.is_forwarded as boolean | null),
    expiresAt: (row.expires_at as string | null) ?? null,
    iv: (row.iv as string | null) ?? null,
  };
}

// ─── Group Message Mapper ───

export function mapGroupMessage(
  row: Record<string, unknown>,
  profiles: Map<string, ProfileRow>
): GroupMessage {
  const senderId = row.sender_id as string;
  const sender = profiles.get(senderId);
  return {
    id: row.id as string,
    senderId,
    senderName: str(sender?.full_name, 'Usuario'),
    senderAvatar: sender?.avatar_url ?? null,
    content: str(row.content as string | null),
    mediaUrl: (row.media_url as string | null) ?? null,
    mediaType: (row.media_type as string | null) ?? null,
    createdAt: ts(row.created_at as string | null),
    editedAt: (row.edited_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    iv: (row.iv as string | null) ?? null,
  };
}

// ─── Conversation Mapper ───

export function mapConversation(
  row: Record<string, unknown>,
  profile: ProfileRow | undefined,
  myUserId: string,
  unreadCount: number
): ConversationItem {
  const otherId = (row.user_1 as string) === myUserId
    ? (row.user_2 as string)
    : (row.user_1 as string);
  return {
    id: row.id as string,
    otherUserId: otherId,
    otherUserName: str(profile?.full_name, 'Usuario'),
    otherUserAvatar: profile?.avatar_url ?? null,
    otherUserOnline: bool(profile?.is_online),
    lastMessage: (row.last_message as string | null) ?? null,
    lastMessageAt: (row.last_message_at as string | null) ?? null,
    unreadCount,
    status: str(row.status as string | null, 'active'),
    disappearTimer: str(row.disappear_timer as string | null, 'off'),
  };
}

// ─── Group Item Mapper ───

export function mapGroupItem(
  row: Record<string, unknown>,
  memberCount: number
): GroupItem {
  return {
    id: row.id as string,
    name: row.name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    lastMessage: (row.last_message as string | null) ?? null,
    lastMessageAt: (row.last_message_at as string | null) ?? null,
    memberCount,
    disappearTimer: str(row.disappear_timer as string | null, 'off'),
  };
}

// ─── Group Member Mapper ───

export function mapGroupMember(
  profile: ProfileRow,
  role: string
): GroupMember {
  return {
    userId: profile.user_id,
    fullName: str(profile.full_name, 'Usuario'),
    displayName: profile.username ? `@${profile.username}` : str(profile.full_name, 'Usuario'),
    avatarUrl: profile.avatar_url ?? null,
    username: profile.username ?? null,
    isOnline: bool(profile.is_online),
    role: safeRole(role),
  };
}

// ─── Group Info Mapper ───

export function mapGroupInfo(row: Record<string, unknown>): GroupInfo {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    inviteCode: (row.invite_code as string | null) ?? null,
    createdBy: row.created_by as string,
    disappearTimer: str(row.disappear_timer as string | null, 'off'),
  };
}