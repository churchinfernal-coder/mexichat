/**
 * MEXICHAT - Payment Requests in Chat v1.0
 * Send "$X" request cards inline, track status, tie to MexiChat Pagos.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type PaymentRequestStatus = 'pending' | 'paid' | 'declined' | 'cancelled' | 'expired';

export interface PaymentRequest {
  id: string;
  requesterId: string;
  payerId: string | null;
  conversationId: string | null;
  groupId: string | null;
  amount: number;
  currency: string;
  description: string | null;
  status: PaymentRequestStatus;
  transactionId: string | null;
  createdAt: string;
  expiresAt: string;
}

function mapPaymentRequest(row: Record<string, unknown>): PaymentRequest {
  return {
    id: row.id as string,
    requesterId: row.requester_id as string,
    payerId: (row.payer_id as string) || null,
    conversationId: (row.conversation_id as string) || null,
    groupId: (row.group_id as string) || null,
    amount: Number(row.amount),
    currency: (row.currency as string) || 'MXN',
    description: (row.description as string) || null,
    status: (row.status as PaymentRequestStatus) || 'pending',
    transactionId: (row.transaction_id as string) || null,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  };
}

// ═══════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════

export function usePaymentRequests(userId: string | undefined) {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);

  const loadRequests = useCallback(async (conversationId?: string, groupId?: string) => {
    if (!userId) return;
    let query = (supabase.from('payment_requests' as any).select('*') as any)
      .or('requester_id.eq.' + userId + ',payer_id.eq.' + userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (conversationId) query = query.eq('conversation_id', conversationId);
    if (groupId) query = query.eq('group_id', groupId);
    const { data } = await query;
    if (data) setRequests((data as any[]).map(mapPaymentRequest));
  }, [userId]);

  // Create payment request
  const createRequest = useCallback(async (opts: {
    amount: number;
    description?: string;
    payerId?: string;
    conversationId?: string;
    groupId?: string;
    currency?: string;
  }) => {
    if (!userId) return null;
    if (opts.amount <= 0 || opts.amount > 50000) {
      toast.error('Monto invalido (1 - 50,000 MXN)');
      return null;
    }
    const insert: Record<string, unknown> = {
      requester_id: userId,
      payer_id: opts.payerId || null,
      conversation_id: opts.conversationId || null,
      group_id: opts.groupId || null,
      amount: opts.amount,
      currency: opts.currency || 'MXN',
      description: opts.description || null,
    };
    const { data, error } = await (supabase
      .from('payment_requests' as any)
      .insert(insert as any) as any)
      .select('*')
      .single();
    if (error) { toast.error('Error al crear solicitud'); return null; }
    const request = mapPaymentRequest(data as Record<string, unknown>);
    setRequests(prev => [request, ...prev]);
    toast.success('Solicitud de pago enviada');
    return request;
  }, [userId]);

  // Cancel a request (requester only)
  const cancelRequest = useCallback(async (id: string) => {
    await (supabase
      .from('payment_requests' as any)
      .update({ status: 'cancelled' } as any) as any)
      .eq('id', id)
      .eq('requester_id', userId);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' as PaymentRequestStatus } : r));
    toast.success('Solicitud cancelada');
  }, [userId]);

  // Decline a request (payer only)
  const declineRequest = useCallback(async (id: string) => {
    await (supabase
      .from('payment_requests' as any)
      .update({ status: 'declined' } as any) as any)
      .eq('id', id);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'declined' as PaymentRequestStatus } : r));
    toast.success('Solicitud rechazada');
  }, []);

  // Mark as paid (after successful payment)
  const markPaid = useCallback(async (id: string, transactionId?: string) => {
    const updates: Record<string, unknown> = { status: 'paid' };
    if (transactionId) updates.transaction_id = transactionId;
    await (supabase
      .from('payment_requests' as any)
      .update(updates as any) as any)
      .eq('id', id);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'paid' as PaymentRequestStatus, transactionId: transactionId || null } : r));
  }, []);

  // Get request by ID
  const getRequest = useCallback((id: string): PaymentRequest | undefined => {
    return requests.find(r => r.id === id);
  }, [requests]);

  // Realtime updates
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('pay-req:' + userId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payment_requests',
        filter: 'requester_id=eq.' + userId,
      }, () => { loadRequests(); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payment_requests',
        filter: 'payer_id=eq.' + userId,
      }, () => { loadRequests(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, loadRequests]);

  return {
    requests,
    createRequest,
    cancelRequest,
    declineRequest,
    markPaid,
    getRequest,
    loadRequests,
  };
}