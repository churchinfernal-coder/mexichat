-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MexiChat Pagos — Migration 002: Add missing tables + harden   ║
-- ║  SAFE: Uses IF NOT EXISTS and ALTER (won't break existing data) ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════��═══════════════════════
-- 1. ADD COLUMNS to existing transactions table
--    Your table already has the core columns. These add
--    enterprise features without touching existing data.
-- ═══════════════════════════════════════════════════════════

-- Idempotency key: prevents duplicate charges
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- After adding, make it unique (only if not already constrained)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_idempotency_key_key'
  ) THEN
    -- Backfill existing rows with unique keys so the constraint doesn't fail
    UPDATE public.transactions
    SET idempotency_key = 'legacy-' || id::text
    WHERE idempotency_key IS NULL;

    ALTER TABLE public.transactions
      ALTER COLUMN idempotency_key SET NOT NULL;

    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_idempotency_key_key UNIQUE (idempotency_key);
  END IF;
END $$;

-- Preference ID from Mercado Pago (separate from provider_tx_id which is the payment ID)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS provider_pref_id text;

-- Fraud audit fields
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS ip_address inet;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS user_agent text;

-- Failure tracking
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS failure_reason text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS retry_count smallint DEFAULT 0;

-- Tighten amount: add max limit
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_amount_max'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT chk_amount_max CHECK (amount <= 500000.00);
  END IF;
END $$;

-- Prevent self-transfers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_no_self_transfer'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT chk_no_self_transfer CHECK (sender_id != receiver_id);
  END IF;
END $$;

-- Description length limit
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_description_length'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT chk_description_length CHECK (char_length(description) <= 280);
  END IF;
END $$;

-- Add 'in_process' and 'charged_back' to status check
-- Must drop old constraint first, then recreate
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending','approved','rejected','cancelled','refunded','in_process','charged_back'));

-- ═══════════════════════════════════════════════════════════
-- 2. MERCADO PAGO OAUTH TOKENS TABLE (new)
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

-- ═══════════════════════════════════════════════════════════
-- 3. PAYMENT RATE LIMITS TABLE (new)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payment_rate_limits (
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_start  timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  total_amount  numeric(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

-- ═══════════════════════════════════════════════════════════
-- 4. ADD webhook_logs COLUMNS (if table exists from prior SQL)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS event_id text;

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS headers jsonb DEFAULT '{}';

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS signature_valid boolean;

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS processing_error text;

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- ═══════════════════════════════════════════════════════════
-- 5. ADDITIONAL INDEXES
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tx_idempotency    ON public.transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_tx_provider_pref  ON public.transactions(provider_pref_id) WHERE provider_pref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_provider_tx    ON public.transactions(provider_tx_id) WHERE provider_tx_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_created        ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_auth_user      ON public.mp_auth(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mp_auth_mp_user   ON public.mp_auth(mp_user_id);
CREATE INDEX IF NOT EXISTS idx_wh_event_id       ON public.webhook_logs(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wh_unprocessed    ON public.webhook_logs(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_rate_window       ON public.payment_rate_limits(user_id, window_start DESC);

-- ═══════════════════════════════════════════════════════════
-- 6. FUNCTIONS
-- ═══════════════════════════════════════════════════════════

-- Auto-update updated_at (safe: CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Rate limit check: returns jsonb { allowed, reason, count, total }
-- Limits: 20 transactions/hour, $50,000 MXN/hour per user
CREATE OR REPLACE FUNCTION public.fn_check_rate_limit(
  p_user_id uuid,
  p_amount numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_window timestamptz;
  v_count  integer;
  v_total  numeric;
BEGIN
  v_window := date_trunc('hour', now());

  INSERT INTO public.payment_rate_limits (user_id, window_start, request_count, total_amount)
  VALUES (p_user_id, v_window, 1, p_amount)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET
    request_count = payment_rate_limits.request_count + 1,
    total_amount  = payment_rate_limits.total_amount + p_amount
  RETURNING request_count, total_amount INTO v_count, v_total;

  IF v_count > 20 THEN
    RETURN jsonb_build_object('allowed', false,
      'reason', format('Límite de transacciones excedido: %s/20 esta hora', v_count),
      'count', v_count, 'total', v_total);
  END IF;

  IF v_total > 50000 THEN
    RETURN jsonb_build_object('allowed', false,
      'reason', format('Límite de monto excedido: $%s/$50,000 MXN esta hora', v_total),
      'count', v_count, 'total', v_total);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'count', v_count, 'total', v_total);
END;
$$;

-- Expire stale pending transactions (>30 min)
CREATE OR REPLACE FUNCTION public.fn_expire_stale_transactions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.transactions
  SET status = 'cancelled',
      failure_reason = 'Auto-expired: no payment received within 30 minutes'
  WHERE status = 'pending'
    AND created_at < now() - interval '30 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Cleanup old rate limit rows
CREATE OR REPLACE FUNCTION public.fn_cleanup_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.payment_rate_limits WHERE window_start < now() - interval '24 hours';
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 7. TRIGGERS (safe: DROP IF EXISTS before CREATE)
-- ═══════════════════════════════════════════════════════════

-- Keep existing trigger on transactions if it works, add for new tables
DROP TRIGGER IF EXISTS trg_mp_auth_updated_at ON public.mp_auth;
CREATE TRIGGER trg_mp_auth_updated_at
  BEFORE UPDATE ON public.mp_auth
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ═══════════════════════════════════════════════════════════
-- 8. ROW LEVEL SECURITY — Harden
-- ═══════════════════════════════════════════════════════════

-- MP Auth: users see only their own
ALTER TABLE public.mp_auth ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mp_auth_select_own" ON public.mp_auth;
CREATE POLICY "mp_auth_select_own" ON public.mp_auth FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mp_auth_insert_own" ON public.mp_auth;
CREATE POLICY "mp_auth_insert_own" ON public.mp_auth FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mp_auth_update_own" ON public.mp_auth;
CREATE POLICY "mp_auth_update_own" ON public.mp_auth FOR UPDATE
  USING (auth.uid() = user_id);

-- Rate limits & webhook logs: service_role only (no user access)
ALTER TABLE public.payment_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rl_no_user_access" ON public.payment_rate_limits;
CREATE POLICY "rl_no_user_access" ON public.payment_rate_limits FOR ALL USING (false);

-- Harden webhook_logs (may already have RLS enabled from prior SQL)
DROP POLICY IF EXISTS "wh_no_user_access" ON public.webhook_logs;
CREATE POLICY "wh_no_user_access" ON public.webhook_logs FOR ALL USING (false);

-- CRITICAL: Replace the transactions UPDATE policy
-- Users should NOT be able to update transaction status directly
-- Only the webhook (via service_role) should update status
DROP POLICY IF EXISTS "transactions_update" ON public.transactions;
CREATE POLICY "transactions_update" ON public.transactions
  FOR UPDATE USING (false);
-- ^ This blocks all user updates. service_role bypasses RLS.

-- ═══════════════════════════════════════════════════════════
-- 9. GRANTS
-- ═══════════════════════════════════════════════════════════

GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.mp_auth TO service_role;
GRANT ALL ON public.webhook_logs TO service_role;
GRANT ALL ON public.payment_rate_limits TO service_role;
GRANT SELECT, INSERT ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mp_auth TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 10. ENABLE REALTIME
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
