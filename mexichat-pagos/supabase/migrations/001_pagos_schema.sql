-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MexiChat Pagos — Complete Database Schema                      ║
-- ║  Migration: 001_pagos_schema                                    ║
-- ║  Run in Supabase SQL Editor                                     ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════
-- ENUM TYPES (type-safe status values)
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE tx_status AS ENUM (
    'pending', 'approved', 'rejected', 'cancelled', 'refunded', 'in_process', 'charged_back'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tx_provider AS ENUM ('mercadopago', 'oxxo', 'paypal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- TRANSACTIONS TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  receiver_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount            numeric(12,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'MXN',
  status            tx_status NOT NULL DEFAULT 'pending',
  provider          tx_provider NOT NULL DEFAULT 'mercadopago',
  provider_tx_id    text,
  provider_pref_id  text,
  provider_data     jsonb DEFAULT '{}',
  description       text,
  chat_id           uuid REFERENCES public.private_chats(id) ON DELETE SET NULL,
  idempotency_key   text UNIQUE NOT NULL,
  ip_address        inet,
  user_agent        text,
  failure_reason    text,
  retry_count       smallint DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT chk_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_amount_max CHECK (amount <= 500000.00),
  CONSTRAINT chk_no_self_transfer CHECK (sender_id != receiver_id),
  CONSTRAINT chk_currency CHECK (currency IN ('MXN', 'USD')),
  CONSTRAINT chk_description_length CHECK (char_length(description) <= 280)
);

COMMENT ON TABLE public.transactions IS 'MexiChat Pagos — Payment transactions via Mercado Pago';
COMMENT ON COLUMN public.transactions.idempotency_key IS 'Client-generated key to prevent duplicate transactions';
COMMENT ON COLUMN public.transactions.ip_address IS 'Sender IP for fraud detection audit trail';

-- ═══════════════════════════════════════════════════════════
-- MERCADO PAGO OAUTH TOKENS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mp_auth (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  mp_access_token   text NOT NULL,
  mp_refresh_token  text NOT NULL,
  mp_user_id        text NOT NULL,
  mp_email          text,
  mp_public_key     text,
  token_expires_at  timestamptz NOT NULL,
  scopes            text[] DEFAULT '{}',
  is_active         boolean DEFAULT true,
  last_used_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mp_auth IS 'Mercado Pago OAuth tokens per user';

-- ═══════════════════════════════════════════════════════════
-- WEBHOOK AUDIT LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider       tx_provider NOT NULL,
  event_type     text NOT NULL,
  event_id       text,
  payload        jsonb NOT NULL DEFAULT '{}',
  headers        jsonb DEFAULT '{}',
  signature_valid boolean,
  processed      boolean DEFAULT false,
  processing_error text,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz
);

COMMENT ON TABLE public.webhook_logs IS 'Immutable audit log of all inbound webhooks';

-- ═══════════════════════════════════════════════════════════
-- RATE LIMITING TABLE (per-user payment rate limits)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payment_rate_limits (
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_start     timestamptz NOT NULL,
  request_count    integer NOT NULL DEFAULT 1,
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

COMMENT ON TABLE public.payment_rate_limits IS 'Sliding window rate limiting for payment requests';

-- ════════════════════���══════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tx_sender          ON public.transactions(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_receiver        ON public.transactions(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_status          ON public.transactions(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tx_chat            ON public.transactions(chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_idempotency     ON public.transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_tx_provider_tx     ON public.transactions(provider_tx_id) WHERE provider_tx_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_provider_pref   ON public.transactions(provider_pref_id) WHERE provider_pref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_created         ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_auth_user       ON public.mp_auth(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mp_auth_mp_user    ON public.mp_auth(mp_user_id);
CREATE INDEX IF NOT EXISTS idx_wh_event_id        ON public.webhook_logs(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wh_unprocessed     ON public.webhook_logs(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_wh_tx              ON public.webhook_logs(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.payment_rate_limits(user_id, window_start DESC);

-- ═══════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Rate limit check: returns true if the user is OVER the limit
-- Limits: max 20 transactions per hour, max $50,000 MXN per hour
CREATE OR REPLACE FUNCTION public.fn_check_rate_limit(
  p_user_id uuid,
  p_amount numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
  v_total numeric;
  v_max_count integer := 20;
  v_max_amount numeric := 50000.00;
BEGIN
  v_window_start := date_trunc('hour', now());

  -- Upsert rate limit counter
  INSERT INTO public.payment_rate_limits (user_id, window_start, request_count, total_amount)
  VALUES (p_user_id, v_window_start, 1, p_amount)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET
    request_count = payment_rate_limits.request_count + 1,
    total_amount  = payment_rate_limits.total_amount + p_amount
  RETURNING request_count, total_amount INTO v_count, v_total;

  -- Check limits
  IF v_count > v_max_count THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Rate limit exceeded: %s/%s transactions this hour', v_count, v_max_count),
      'count', v_count,
      'total', v_total
    );
  END IF;

  IF v_total > v_max_amount THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Amount limit exceeded: $%s/$%s MXN this hour', v_total, v_max_amount),
      'count', v_count,
      'total', v_total
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'count', v_count, 'total', v_total);
END;
$$;

-- Clean up old rate limit entries (run via pg_cron daily)
CREATE OR REPLACE FUNCTION public.fn_cleanup_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.payment_rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$;

-- Expire stale pending transactions (run via pg_cron every 15 min)
CREATE OR REPLACE FUNCTION public.fn_expire_stale_transactions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.transactions
  SET status = 'cancelled', failure_reason = 'Expired: no payment received within 30 minutes'
  WHERE status = 'pending'
    AND created_at < now() - interval '30 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_tx_updated_at ON public.transactions;
CREATE TRIGGER trg_tx_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_mp_auth_updated_at ON public.mp_auth;
CREATE TRIGGER trg_mp_auth_updated_at
  BEFORE UPDATE ON public.mp_auth
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_rate_limits ENABLE ROW LEVEL SECURITY;

-- Transactions: users see only their own (sent or received)
DROP POLICY IF EXISTS "tx_select_own" ON public.transactions;
CREATE POLICY "tx_select_own" ON public.transactions FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Transactions: users can only insert as sender
DROP POLICY IF EXISTS "tx_insert_sender" ON public.transactions;
CREATE POLICY "tx_insert_sender" ON public.transactions FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);

-- Transactions: no direct updates from users (only service_role via webhooks)
-- This prevents users from changing their own transaction status
DROP POLICY IF EXISTS "tx_no_user_update" ON public.transactions;
CREATE POLICY "tx_no_user_update" ON public.transactions FOR UPDATE USING (false);

-- MP Auth: users see only their own
DROP POLICY IF EXISTS "mp_auth_select_own" ON public.mp_auth;
CREATE POLICY "mp_auth_select_own" ON public.mp_auth FOR SELECT USING (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "mp_auth_insert_own" ON public.mp_auth;
CREATE POLICY "mp_auth_insert_own" ON public.mp_auth FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "mp_auth_update_own" ON public.mp_auth;
CREATE POLICY "mp_auth_update_own" ON public.mp_auth FOR UPDATE USING (
  auth.uid() = user_id
);

-- Webhook logs: no user access (service_role only)
DROP POLICY IF EXISTS "wh_no_user_access" ON public.webhook_logs;
CREATE POLICY "wh_no_user_access" ON public.webhook_logs FOR ALL USING (false);

-- Rate limits: no user access (service_role only)
DROP POLICY IF EXISTS "rl_no_user_access" ON public.payment_rate_limits;
CREATE POLICY "rl_no_user_access" ON public.payment_rate_limits FOR ALL USING (false);

-- ═══════════════════════════════════════════════════════════
-- ENABLE REALTIME (for live transaction status in frontend)
-- ═══════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- ═══════════════════════════════════════════════════════════
-- GRANTS (service_role gets full access for Edge Functions)
-- ═══════════════════════════════════════════════════════════

GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.mp_auth TO service_role;
GRANT ALL ON public.webhook_logs TO service_role;
GRANT ALL ON public.payment_rate_limits TO service_role;

GRANT SELECT, INSERT ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mp_auth TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- OPTIONAL: pg_cron jobs (if extension enabled)
-- ═══════════════════════════════════════════════════════════

-- SELECT cron.schedule('expire-stale-tx', '*/15 * * * *', $$SELECT public.fn_expire_stale_transactions()$$);
-- SELECT cron.schedule('cleanup-rate-limits', '0 3 * * *', $$SELECT public.fn_cleanup_rate_limits()$$);
