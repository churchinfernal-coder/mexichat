-- Carrier-grade push hardening: replay protection + per-actor throttling

-- 1) Server-side counters for per-minute push request rate limits
CREATE TABLE IF NOT EXISTS public.push_request_limits (
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_ip text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_user_id, source_ip, window_start),
  CONSTRAINT push_request_limits_source_ip_len CHECK (char_length(source_ip) <= 64)
);

CREATE INDEX IF NOT EXISTS idx_push_request_limits_user_window
  ON public.push_request_limits(actor_user_id, window_start DESC);

-- 2) Idempotency keys to block replay/double-send within short TTL
CREATE TABLE IF NOT EXISTS public.push_idempotency_keys (
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  request_hash text,
  PRIMARY KEY (actor_user_id, idempotency_key),
  CONSTRAINT push_idempotency_key_len CHECK (char_length(idempotency_key) BETWEEN 16 AND 128)
);

CREATE INDEX IF NOT EXISTS idx_push_idempotency_expires
  ON public.push_idempotency_keys(expires_at);

-- 3) No direct user access; only backend/service-role logic should read/write
ALTER TABLE public.push_request_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_rl_no_user_access" ON public.push_request_limits;
CREATE POLICY "push_rl_no_user_access"
  ON public.push_request_limits
  FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "push_idem_no_user_access" ON public.push_idempotency_keys;
CREATE POLICY "push_idem_no_user_access"
  ON public.push_idempotency_keys
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- 4) Atomic per-minute rate limit function
CREATE OR REPLACE FUNCTION public.fn_check_push_rate_limit(
  p_actor_user_id uuid,
  p_source_ip text,
  p_limit integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_count integer;
  v_limit integer := GREATEST(COALESCE(p_limit, 60), 1);
BEGIN
  DELETE FROM public.push_request_limits
   WHERE window_start < now() - interval '2 hours';

  v_window := date_trunc('minute', now());

  INSERT INTO public.push_request_limits (actor_user_id, source_ip, window_start, request_count)
  VALUES (p_actor_user_id, left(coalesce(p_source_ip, 'unknown'), 64), v_window, 1)
  ON CONFLICT (actor_user_id, source_ip, window_start)
  DO UPDATE SET
    request_count = public.push_request_limits.request_count + 1,
    updated_at = now()
  RETURNING request_count INTO v_count;

  IF v_count > v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'count', v_count,
      'limit', v_limit,
      'window_start', v_window
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'count', v_count,
    'limit', v_limit,
    'window_start', v_window
  );
END;
$$;

-- 5) Atomic idempotency registration function
CREATE OR REPLACE FUNCTION public.fn_register_push_idempotency(
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_ttl_seconds integer DEFAULT 120,
  p_request_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_ttl_seconds integer := LEAST(GREATEST(COALESCE(p_ttl_seconds, 120), 30), 900);
  v_existing_hash text;
BEGIN
  DELETE FROM public.push_idempotency_keys
   WHERE expires_at < now() - interval '1 hour';

  DELETE FROM public.push_idempotency_keys
   WHERE actor_user_id = p_actor_user_id
     AND idempotency_key = p_idempotency_key
     AND expires_at <= now();

  INSERT INTO public.push_idempotency_keys (
    actor_user_id,
    idempotency_key,
    expires_at,
    request_hash
  )
  VALUES (
    p_actor_user_id,
    p_idempotency_key,
    now() + make_interval(secs => v_ttl_seconds),
    p_request_hash
  )
  ON CONFLICT (actor_user_id, idempotency_key)
  DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 1 THEN
    RETURN jsonb_build_object(
      'accepted', true,
      'ttl_seconds', v_ttl_seconds
    );
  END IF;

  SELECT request_hash
    INTO v_existing_hash
    FROM public.push_idempotency_keys
   WHERE actor_user_id = p_actor_user_id
     AND idempotency_key = p_idempotency_key
     AND expires_at > now()
   LIMIT 1;

  IF COALESCE(v_existing_hash, '') <> COALESCE(p_request_hash, '') THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'idempotency_key_payload_mismatch'
    );
  END IF;

  RETURN jsonb_build_object(
    'accepted', false,
    'reason', 'replay_detected'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_check_push_rate_limit(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_register_push_idempotency(uuid, text, integer, text) TO service_role;
