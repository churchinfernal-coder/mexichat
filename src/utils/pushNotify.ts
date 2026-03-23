/**
 * MEXICHAT — Push Notification Sender (Client → Edge Function)
 * 
 * Calls the send-push edge function to deliver notifications
 * to the target user's devices via Web Push / native push.
 */

import { supabase } from '@/integrations/supabase/client';

interface PushPayload {
  targetUserId: string;
  type: 'message' | 'call' | 'incoming_call' | 'video_call';
  title: string;
  body: string;
  fromUserId?: string;
  conversationId?: string;
  callType?: 'audio' | 'video';
  avatarUrl?: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || 'https://cchakgecusfybcokbmau.supabase.co';

export async function sendPushNotification(payload: PushPayload): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn('[pushNotify] No session — cannot send push');
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        targetUserId: payload.targetUserId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        fromUserId: payload.fromUserId,
        conversationId: payload.conversationId,
        callType: payload.callType,
        avatarUrl: payload.avatarUrl,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      console.warn('[pushNotify] Edge function error:', response.status, err);
    }
  } catch (err) {
    // Push is best-effort — never block the sending flow
    console.warn('[pushNotify] Failed:', err);
  }
}