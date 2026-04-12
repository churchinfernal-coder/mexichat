import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type GroupItem, mapGroupItem } from '@/utils/messageMappers';

export function useGroups(myUserId: string | undefined) {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!myUserId) return;
    setLoading(true);

    try {
      const { data: memberRows, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', myUserId);

      if (memberErr) {
        console.error('[useGroups] member fetch error:', memberErr);
        if (mountedRef.current) setLoading(false);
        return;
      }

      if (!memberRows?.length) {
        if (mountedRef.current) { setGroups([]); setLoading(false); }
        return;
      }

      const groupIds = memberRows.map(r => r.group_id as string);

      const { data: groupRows, error: groupErr } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .order('last_message_at', { ascending: false });

      if (groupErr) {
        console.error('[useGroups] groups fetch error:', groupErr);
        if (mountedRef.current) setLoading(false);
        return;
      }

      if (!groupRows) { if (mountedRef.current) setLoading(false); return; }

      // Batch member counts
      const memberCountMap = new Map<string, number>();
      const { data: allMembers } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds);

      if (allMembers) {
        for (const r of allMembers) {
          const gid = r.group_id as string;
          memberCountMap.set(gid, (memberCountMap.get(gid) ?? 0) + 1);
        }
      }

      // Group unread — bypass generated types with raw rpc call
      const newUnread = new Map<string, number>();
      try {
        const rpcClient = supabase.rpc as unknown as (
          fn: string,
          params: Record<string, unknown>
        ) => Promise<{ data: Array<{ group_id: string; last_read_at: string }> | null; error: unknown }>;

        const { data: receiptRows } = await rpcClient('get_group_read_receipts', {
          p_user_id: myUserId,
          p_group_ids: groupIds,
        });

        if (receiptRows) {
          for (const r of receiptRows) {
            const { count } = await supabase
              .from('group_messages')
              .select('id', { count: 'exact', head: true })
              .eq('group_id', r.group_id)
              .gt('created_at', r.last_read_at)
              .neq('sender_id', myUserId);
            newUnread.set(r.group_id, count ?? 0);
          }
        }
      } catch {
        // RPC not available — skip unread counts gracefully
      }

      if (!mountedRef.current) return;
      setUnreadCounts(newUnread);

      const items = groupRows.map(g =>
        mapGroupItem(g as unknown as Record<string, unknown>, memberCountMap.get(g.id as string) ?? 0)
      );

      setGroups(items);
    } catch (err) {
      console.error('[useGroups] critical error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [myUserId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: groups table changes (name, last_message, etc.)
  useEffect(() => {
    if (!myUserId) return;
    const channel = supabase
      .channel('group-list-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myUserId, load]);

  // Realtime: group_members table changes (member added/removed/role changed → count updates)
  useEffect(() => {
    if (!myUserId) return;
    const channel = supabase
      .channel('group-members-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myUserId, load]);

  return { groups, loading, unreadCounts, reload: load };
}