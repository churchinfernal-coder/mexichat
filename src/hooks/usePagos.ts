/**
 * MexiChat — usePagos hook
 *
 * WHY THIS USES A SEPARATE CLIENT:
 * The auto-generated Supabase types file (src/integrations/supabase/types.ts)
 * was generated BEFORE the 'transactions' table was created in the database.
 * The typed client rejects `.from('transactions')` because it's not in the type map.
 *
 * Solution: We create a small untyped Supabase client just for pagos queries.
 * This completely eliminates all 5 type errors while keeping our own types strict.
 *
 * PERMANENT FIX: Run this command to regenerate types, then you can switch back
 * to the shared client:
 *   npx supabase gen types typescript --project-id cchakgecusfybcokbmau > src/integrations/supabase/types.ts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase as typedSupabase } from '@/integrations/supabase/client';
import type { TxStatus, Provider } from '@/lib/mercadopago';
type TxProvider = Provider;

export type { TxStatus, TxProvider };

// ─── Untyped Supabase client for pagos (bypasses stale generated types) ───
const SUPABASE_URL = 'https://cchakgecusfybcokbmau.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjaGFrZ2VjdXNmeWJjb2tibWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTA3NDksImV4cCI6MjA4Mzk2Njc0OX0.TWy1NmGHFDzBSJi3-z1k4f8_bkoxP94NPBUqOrGyGb8';

// This client has NO generated types — .from('transactions') just works
const pagosClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: sync auth session from the typed client to our untyped one
async function syncAuth(): Promise<string | null> {
  const { data: { session } } = await typedSupabase.auth.getSession();
  if (session?.access_token) {
    await pagosClient.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    return session.access_token;
  }
  return null;
}

// ─── Types ─────────────────────────────────────────────────

export interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  currency: string;
  status: TxStatus;
  provider: TxProvider;
  provider_tx_id: string | null;
  provider_pref_id: string | null;
  provider_data: Record<string, unknown>;
  description: string | null;
  chat_id: string | null;
  idempotency_key: string | null;
  ip_address: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  sender?: { full_name: string; username: string; avatar_url: string | null } | null;
  receiver?: { full_name: string; username: string; avatar_url: string | null } | null;
}

export interface SendPayload {
  receiverId: string;
  amount: number;
  currency?: 'MXN' | 'USD';
  provider?: TxProvider;
  description?: string;
  chatId?: string;
  providerTxId?: string;
  providerData?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface UsePagosReturn {
  transactions: Transaction[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  hasMore: boolean;
  sendTransaction: (payload: SendPayload) => Promise<Transaction>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// ─── Constants ────────────────────────────��────────────────

const PAGE_SIZE = 20;
const CACHE_TTL_MS = 30_000;
const MAX_AMOUNT = 500_000;
const MIN_AMOUNT = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TX_SELECT = `
  id, sender_id, receiver_id, amount, currency, status, provider,
  provider_tx_id, provider_pref_id, provider_data, description,
  chat_id, idempotency_key, ip_address, failure_reason,
  created_at, updated_at,
  sender:profiles!transactions_sender_id_fkey(full_name,username,avatar_url),
  receiver:profiles!transactions_receiver_id_fkey(full_name,username,avatar_url)
`;

// ─── Helpers ───────────────────────────────────────────────

function generateKey(): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  return `mc-${ts}-${rand}`;
}

function sanitize(s: string | undefined | null): string | null {
  if (!s) return null;
  return s.trim().replace(/\0/g, '').replace(/<[^>]*>/g, '').substring(0, 280) || null;
}

function validate(p: SendPayload, uid: string): string | null {
  if (!p.receiverId || !UUID_RE.test(p.receiverId)) return 'ID de destinatario inválido';
  if (p.receiverId === uid) return 'No puedes enviarte dinero a ti mismo';
  if (typeof p.amount !== 'number' || !isFinite(p.amount)) return 'Monto inválido';
  if (p.amount < MIN_AMOUNT) return `Monto mínimo: $${MIN_AMOUNT}`;
  if (p.amount > MAX_AMOUNT) return `Monto máximo: $${MAX_AMOUNT.toLocaleString()}`;
  if (p.chatId && !UUID_RE.test(p.chatId)) return 'ID de chat inválido';
  return null;
}

function mapRow(row: Record<string, unknown>): Transaction {
  return {
    id:               String(row.id ?? ''),
    sender_id:        String(row.sender_id ?? ''),
    receiver_id:      String(row.receiver_id ?? ''),
    amount:           Number(row.amount ?? 0),
    currency:         String(row.currency ?? 'MXN'),
    status:           (row.status as TxStatus) ?? 'pending',
    provider:         (row.provider as TxProvider) ?? 'mercadopago',
    provider_tx_id:   (row.provider_tx_id as string) ?? null,
    provider_pref_id: (row.provider_pref_id as string) ?? null,
    provider_data:    (row.provider_data as Record<string, unknown>) ?? {},
    description:      (row.description as string) ?? null,
    chat_id:          (row.chat_id as string) ?? null,
    idempotency_key:  (row.idempotency_key as string) ?? null,
    ip_address:       (row.ip_address as string) ?? null,
    failure_reason:   (row.failure_reason as string) ?? null,
    created_at:       String(row.created_at ?? ''),
    updated_at:       String(row.updated_at ?? ''),
    sender:           (row.sender as Transaction['sender']) ?? null,
    receiver:         (row.receiver as Transaction['receiver']) ?? null,
  };
}

// Simple page cache
const cache = new Map<string, { data: Transaction[]; ts: number }>();

// ─── Hook ──────────────────────────────────────────────────

export function usePagos(userId: string | undefined): UsePagosReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(false);
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [hasMore, setHasMore]           = useState(false);

  const offsetRef  = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // ── Fetch ─────────────────────────────────────────────────

  const fetchTransactions = useCallback(async (reset = false) => {
    if (!userId || !UUID_RE.test(userId)) return;

    await syncAuth();

    const offset = reset ? 0 : offsetRef.current;
    const cacheKey = `${userId}:${offset}`;

    if (!reset) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        if (mountedRef.current) {
          setTransactions(prev => reset ? cached.data : [...prev, ...cached.data]);
          setHasMore(cached.data.length === PAGE_SIZE);
          offsetRef.current = offset + cached.data.length;
        }
        return;
      }
    }

    if (mountedRef.current) { setLoading(true); setError(null); }

    try {
      const { data, error: qErr } = await pagosClient
        .from('transactions')
        .select(TX_SELECT)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (qErr) throw new Error(qErr.message);

      const rows = (data ?? []).map((r: Record<string, unknown>) => mapRow(r));
      cache.set(cacheKey, { data: rows, ts: Date.now() });

      if (mountedRef.current) {
        setTransactions(prev => reset ? rows : [...prev, ...rows]);
        setHasMore(rows.length === PAGE_SIZE);
        offsetRef.current = offset + rows.length;
      }
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Error cargando transacciones');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  // ── Realtime ──────────────────────────────────────────────

  useEffect(() => {
    if (!userId || !UUID_RE.test(userId)) return;

    fetchTransactions(true);

    // Use the typed client for realtime (channel subscriptions don't hit table types)
    const channel = typedSupabase
      .channel(`pagos:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `sender_id=eq.${userId}` },
        () => { cache.clear(); fetchTransactions(true); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `receiver_id=eq.${userId}` },
        () => { cache.clear(); fetchTransactions(true); }
      )
      .subscribe((status, err) => {
        if (err) console.error('[usePagos] Realtime error:', err);
      });

    return () => { typedSupabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Send ──────────────────────────────────────────────────

  const sendTransaction = useCallback(async (payload: SendPayload): Promise<Transaction> => {
    if (!userId || !UUID_RE.test(userId)) throw new Error('No autenticado');

    const validationError = validate(payload, userId);
    if (validationError) {
      setError(validationError);
      throw new Error(validationError);
    }

    const amount = Math.round(payload.amount * 100) / 100;
    const idempotencyKey = payload.idempotencyKey || generateKey();

    if (mountedRef.current) { setSending(true); setError(null); }

    try {
      await syncAuth();

      const { data, error: insertErr } = await pagosClient
        .from('transactions')
        .insert({
          sender_id:       userId,
          receiver_id:     payload.receiverId,
          amount,
          currency:        payload.currency ?? 'MXN',
          provider:        payload.provider ?? 'mercadopago',
          description:     sanitize(payload.description),
          chat_id:         payload.chatId ?? null,
          provider_tx_id:  payload.providerTxId ?? null,
          provider_data:   payload.providerData ?? {},
          idempotency_key: idempotencyKey,
          status:          'pending',
        })
        .select(TX_SELECT)
        .single();

      if (insertErr) {
        if (insertErr.code === '23505') throw new Error('Transacción duplicada');
        if (insertErr.code === '23514') {
          if (insertErr.message.includes('chk_no_self_transfer'))
            throw new Error('No puedes enviarte dinero a ti mismo');
          if (insertErr.message.includes('chk_amount_max'))
            throw new Error(`Monto máximo: $${MAX_AMOUNT.toLocaleString()} MXN`);
          if (insertErr.message.includes('amount'))
            throw new Error('Monto inválido');
        }
        throw new Error(insertErr.message);
      }

      if (!data) throw new Error('Sin respuesta del servidor');

      const tx = mapRow(data as Record<string, unknown>);
      cache.clear();

      if (mountedRef.current) {
        setTransactions(prev => [tx, ...prev]);
      }

      return tx;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error enviando pago';
      if (mountedRef.current) setError(msg);
      throw new Error(msg);
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [userId]);

  const loadMore = useCallback(() => fetchTransactions(false), [fetchTransactions]);
  const refresh = useCallback(async () => {
    cache.clear();
    offsetRef.current = 0;
    await fetchTransactions(true);
  }, [fetchTransactions]);

  return { transactions, loading, sending, error, hasMore, sendTransaction, loadMore, refresh, clearError };
}



