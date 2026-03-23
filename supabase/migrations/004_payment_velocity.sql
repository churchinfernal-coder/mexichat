-- Payment velocity check: max 5 payments per 10 minutes per user
-- Called by payment-oxxo edge function via rpc('fn_check_rate_limit')

CREATE OR REPLACE FUNCTION fn_check_rate_limit(p_user_id UUID, p_amount NUMERIC DEFAULT 0)
RETURNS JSONB AS $$
DECLARE
  recent_count INT;
  recent_sum NUMERIC;
  daily_count INT;
  daily_sum NUMERIC;
BEGIN
  -- Last 10 minutes: max 5 transactions
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO recent_count, recent_sum
  FROM transactions
  WHERE sender_id = p_user_id
    AND created_at > NOW() - INTERVAL '10 minutes'
    AND status NOT IN ('rejected', 'cancelled');

  IF recent_count >= 5 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Limite de velocidad: maximo 5 transacciones cada 10 minutos. Espera unos minutos.'
    );
  END IF;

  -- Last 24 hours: max 50 transactions
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO daily_count, daily_sum
  FROM transactions
  WHERE sender_id = p_user_id
    AND created_at > NOW() - INTERVAL '24 hours'
    AND status NOT IN ('rejected', 'cancelled');

  IF daily_count >= 50 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Limite diario: maximo 50 transacciones por dia.'
    );
  END IF;

  -- Daily amount limit: $100,000 MXN
  IF daily_sum + p_amount > 100000 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Limite diario de monto: maximo $100,000 MXN por dia.'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (called via RPC)
GRANT EXECUTE ON FUNCTION fn_check_rate_limit(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_check_rate_limit(UUID, NUMERIC) TO service_role;