/**
 * MEXICHAT — useUnreadCounts
 * Lightweight hook that returns real-time total unread counts for
 * individual chats and group chats. Subscribes to postgres_changes
 * so badges update without polling.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UnreadCounts {
  chats: number;
  groups: number;
}

export function useUnreadCounts(myUserId: string | undefined): UnreadCounts {
  const [counts, setCounts] = useState<UnreadCounts>({ chats: 0, groups: 0 });

  const refresh = useCallback(async () => {
    if (!myUserId) { setCounts({ chats: 0, groups: 0 }); return; }

    // ── Individual chat unread ──
    let chatUnread = 0;
    try {
      const { count } = await supabase
        .from('private_messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', myUserId)
        .eq('is_read', false);
      chatUnread = count ?? 0;
    } catch {}

    // ── Group chat unread (best-effort via RPC or fallback) ──
    let groupUnread = 0;
    try {
      const { data: memberRows } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', myUserId);

      if (memberRows?.length) {
        const groupIds = memberRows.map(r => r.group_id as string);

        const rpcClient = supabase.rpc as unknown as (
          fn: string,
          params: Record<string, unknown>
        ) => Promise<{ data: Array<{ group_id: string; last_read_at: string }> | null; error: unknown }>;

        const { data: receiptRows } = await rpcClient('get_group_read_receipts', {
          p_user_id: myUserId,
          p_group_ids: groupIds,
        });

        if (receiptRows) {
          const results = await Promise.all(
            receiptRows.map(async (r) => {
              const { count } = await supabase
                .from('group_messages')
                .select('id', { count: 'exact', head: true })
                .eq('group_id', r.group_id)
                .gt('created_at', r.last_read_at)
                .neq('sender_id', myUserId);
              return count ?? 0;
            })
          );
          groupUnread = results.reduce((sum, n) => sum + n, 0);
        }
      }
    } catch {
      // RPC may not exist — gracefully show 0
    }

    setCounts({ chats: chatUnread, groups: groupUnread });
  }, [myUserId]);

  // Initial load
  useEffect(() => { refresh(); }, [refresh]);

  // Real-time: re-count on any private_message INSERT/UPDATE
  useEffect(() => {
    if (!myUserId) return;
    const channel = supabase
      .channel('home-unread-dm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_messages' }, () => {
        refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myUserId, refresh]);

  // Real-time: re-count on any group_message INSERT
  useEffect(() => {
    if (!myUserId) return;
    const channel = supabase
      .channel('home-unread-groups')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, () => {
        refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myUserId, refresh]);

  return counts;
}
