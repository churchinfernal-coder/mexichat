import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GroupInvite {
  id: string;
  groupId: string;
  inviteCode: string;
  createdBy: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface PendingJoinRequest {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

function mapInvite(row: Record<string, unknown>): GroupInvite {
  return {
    id: String(row.id ?? ''),
    groupId: String(row.group_id ?? ''),
    inviteCode: String(row.invite_code ?? ''),
    createdBy: String(row.created_by ?? ''),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    maxUses: row.max_uses != null ? Number(row.max_uses) : null,
    useCount: Number(row.use_count ?? 0),
    isActive: row.is_active !== false,
    createdAt: String(row.created_at ?? ''),
  };
}

export function useGroupInvites(currentUserId: string | undefined) {
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [joinRequests, setJoinRequests] = useState<PendingJoinRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const generateInviteLink = useCallback(async (
    groupId: string,
    options?: { expiresInHours?: number; maxUses?: number }
  ): Promise<string | null> => {
    if (!currentUserId) return null;
    setLoading(true);
    try {
      const code = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const expiresAt = options?.expiresInHours
        ? new Date(Date.now() + options.expiresInHours * 3600000).toISOString()
        : null;

      const { data, error } = await supabase.from('group_invites').insert({
        group_id: groupId,
        invite_code: code,
        created_by: currentUserId,
        expires_at: expiresAt,
        max_uses: options?.maxUses ?? null,
        use_count: 0,
        is_active: true,
      }).select().single();

      if (error) { toast.error('Error al generar enlace'); return null; }
      const invite = mapInvite(data as Record<string, unknown>);
      setInvites(prev => [...prev, invite]);
      toast.success('Enlace de invitación creado');
      return `${window.location.origin}/invite/${code}`;
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const loadInvites = useCallback(async (groupId: string) => {
    const { data } = await supabase.from('group_invites')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (data) setInvites(data.map(r => mapInvite(r as Record<string, unknown>)));
  }, []);

  const revokeInvite = useCallback(async (inviteId: string) => {
    const { error } = await supabase.from('group_invites')
      .update({ is_active: false })
      .eq('id', inviteId);
    if (error) { toast.error('Error al revocar'); return; }
    setInvites(prev => prev.filter(i => i.id !== inviteId));
    toast.success('Enlace revocado');
  }, []);

  const revokeAllInvites = useCallback(async (groupId: string) => {
    await supabase.from('group_invites')
      .update({ is_active: false })
      .eq('group_id', groupId);
    setInvites([]);
    toast.success('Todos los enlaces revocados');
  }, []);

  const acceptInviteByCode = useCallback(async (code: string): Promise<{ groupId: string; groupName: string } | null> => {
    if (!currentUserId) return null;
    setLoading(true);
    try {
      const { data: invite, error: fetchErr } = await supabase.from('group_invites')
        .select('id, group_id, expires_at, max_uses, use_count, is_active')
        .eq('invite_code', code)
        .eq('is_active', true)
        .single();

      if (fetchErr || !invite) { toast.error('Enlace inválido o expirado'); return null; }
      const inv = invite as Record<string, unknown>;

      if (inv.expires_at && new Date(String(inv.expires_at)) < new Date()) {
        toast.error('Este enlace ha expirado');
        await supabase.from('group_invites').update({ is_active: false }).eq('id', String(inv.id));
        return null;
      }
      if (inv.max_uses != null && Number(inv.use_count) >= Number(inv.max_uses)) {
        toast.error('Este enlace ha alcanzado el límite de usos');
        return null;
      }

      const groupId = String(inv.group_id);

      // Check if already a member
      const { data: existing } = await supabase.from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (existing) { toast.info('Ya eres miembro de este grupo'); }
      else {
        // Check if group requires approval
        const { data: groupData } = await supabase.from('groups')
          .select('id, name, is_private')
          .eq('id', groupId)
          .single();

        if (!groupData) { toast.error('Grupo no encontrado'); return null; }
        const group = groupData as Record<string, unknown>;

        if (group.is_private) {
          // Submit join request
          await supabase.from('group_join_requests').insert({
            group_id: groupId,
            user_id: currentUserId,
            status: 'pending',
          });
          toast.success('Solicitud enviada. Un administrador debe aprobarla.');
          return { groupId, groupName: String(group.name ?? 'Grupo') };
        }

        // Direct join
        const { error: joinErr } = await supabase.from('group_members')
          .insert({ group_id: groupId, user_id: currentUserId, role: 'member' });
        if (joinErr) {
          if (joinErr.code === '23505') toast.info('Ya eres miembro');
          else { toast.error('Error al unirse'); return null; }
        }
      }

      // Increment use count
      await supabase.from('group_invites')
        .update({ use_count: Number(inv.use_count) + 1 })
        .eq('id', String(inv.id));

      const { data: groupInfo } = await supabase.from('groups')
        .select('id, name').eq('id', groupId).single();

      toast.success(`Te has unido al grupo`);
      return {
        groupId,
        groupName: String((groupInfo as Record<string, unknown>)?.name ?? 'Grupo'),
      };
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const loadJoinRequests = useCallback(async (groupId: string) => {
    const { data } = await supabase.from('group_join_requests')
      .select('id, group_id, user_id, status, created_at')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) { setJoinRequests([]); return; }

    const userIds = data.map(r => String((r as Record<string, unknown>).user_id));
    const { data: profiles } = await supabase.from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map<string, Record<string, unknown>>();
    if (profiles) profiles.forEach(p => profileMap.set(String((p as Record<string, unknown>).id), p as Record<string, unknown>));

    setJoinRequests(data.map(r => {
      const row = r as Record<string, unknown>;
      const profile = profileMap.get(String(row.user_id));
      return {
        id: String(row.id),
        groupId: String(row.group_id),
        userId: String(row.user_id),
        userName: String(profile?.full_name ?? 'Usuario'),
        userAvatar: profile?.avatar_url ? String(profile.avatar_url) : null,
        requestedAt: String(row.created_at),
        status: String(row.status) as 'pending',
      };
    }));
  }, []);

  const approveJoinRequest = useCallback(async (requestId: string, userId: string, groupId: string) => {
    await supabase.from('group_join_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);
    await supabase.from('group_members')
      .insert({ group_id: groupId, user_id: userId, role: 'member' });
    setJoinRequests(prev => prev.filter(r => r.id !== requestId));
    toast.success('Solicitud aprobada');
  }, []);

  const rejectJoinRequest = useCallback(async (requestId: string) => {
    await supabase.from('group_join_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    setJoinRequests(prev => prev.filter(r => r.id !== requestId));
    toast.success('Solicitud rechazada');
  }, []);

  return {
    invites,
    joinRequests,
    loading,
    generateInviteLink,
    loadInvites,
    revokeInvite,
    revokeAllInvites,
    acceptInviteByCode,
    loadJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
  };
}