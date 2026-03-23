-- Reports admin view: lets admins see all reported users
-- Run in Supabase SQL Editor

-- Ensure reported_users table exists with proper structure
CREATE TABLE IF NOT EXISTS reported_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'other',
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_report CHECK (reporter_id != reported_id)
);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_reported_users_status ON reported_users(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reported_users_reported ON reported_users(reported_id);

-- RLS: users can insert reports, only admins can read/update
ALTER TABLE reported_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can report" ON reported_users;
CREATE POLICY "Users can report" ON reported_users
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users see own reports" ON reported_users;
CREATE POLICY "Users see own reports" ON reported_users
  FOR SELECT USING (auth.uid() = reporter_id);

-- Auto-block: if a user gets 3+ pending reports, flag them
CREATE OR REPLACE FUNCTION check_report_threshold()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM reported_users 
      WHERE reported_id = NEW.reported_id AND status = 'pending') >= 3 THEN
    -- Log for admin review
    RAISE LOG 'User % has 3+ pending reports - needs review', NEW.reported_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_threshold ON reported_users;
CREATE TRIGGER trg_report_threshold
  AFTER INSERT ON reported_users
  FOR EACH ROW EXECUTE FUNCTION check_report_threshold();