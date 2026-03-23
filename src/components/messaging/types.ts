export interface ChatProfile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  full_name?: string;
  email?: string;
  username?: string;
  is_online?: boolean;
}

export interface Conversation {
  id: string;
  user_1: string;
  user_2: string;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  other_user?: ChatProfile;
  unread_count?: number;
}

export interface PrivateMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  is_read: boolean;
  created_at: string;
}

// ✅ FIXED: Aligned with CallContext — 'audio' not 'voice'
export interface CallState {
  callType: 'audio' | 'video';
  callStatus: 'idle' | 'calling' | 'ringing' | 'active' | 'ended';
  targetUserId?: string;
}