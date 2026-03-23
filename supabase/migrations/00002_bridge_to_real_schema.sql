-- ═══════════════════════════════════════════════════════════════════════════════
-- MexiChat — Bridge Migration
-- Adds missing columns, tables, views, and functions so the app code works
-- with the EXISTING database schema. Safe to re-run (all idempotent).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. PROFILES: Add user_id alias (= id) + missing columns ────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language text DEFAULT 'es';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_key text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text;

UPDATE profiles SET user_id = id WHERE user_id IS NULL;

-- Trigger: keep user_id = id always
CREATE OR REPLACE FUNCTION sync_profile_user_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.user_id := NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aaa_sync_profile_user_id ON profiles;
CREATE TRIGGER aaa_sync_profile_user_id
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_user_id();

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- ─── 2. PRIVATE_CHATS: Add missing columns the app expects ──────────────────

ALTER TABLE private_chats ADD COLUMN IF NOT EXISTS last_message text;
ALTER TABLE private_chats ADD COLUMN IF NOT EXISTS blocked_by uuid;
ALTER TABLE private_chats ADD COLUMN IF NOT EXISTS disappear_timer text;
ALTER TABLE private_chats ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE private_chats ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE private_chats ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Updatable view so app code using .from('conversations') works
-- (SELECT/INSERT/UPDATE/DELETE all pass through to private_chats)
CREATE OR REPLACE VIEW conversations AS SELECT * FROM private_chats;

-- ─── 3. PRIVATE_MESSAGES: Add conversation_id + media_url aliases ────────────

ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS conversation_id uuid;
ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS iv text;
ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS is_forwarded boolean DEFAULT false;
ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Backfill from existing data
UPDATE private_messages SET conversation_id = chat_id
  WHERE conversation_id IS NULL AND chat_id IS NOT NULL;
UPDATE private_messages SET media_url = attachment_url
  WHERE media_url IS NULL AND attachment_url IS NOT NULL;

-- Trigger: sync conversation_id↔chat_id, media_url↔attachment_url, auto-set receiver_id
CREATE OR REPLACE FUNCTION pm_before_save()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Sync conversation_id ↔ chat_id
  NEW.conversation_id := COALESCE(NEW.conversation_id, NEW.chat_id);
  NEW.chat_id := COALESCE(NEW.chat_id, NEW.conversation_id);

  -- Sync media_url ↔ attachment_url
  IF NEW.media_url IS NOT NULL AND NEW.attachment_url IS NULL THEN
    NEW.attachment_url := NEW.media_url;
  ELSIF NEW.attachment_url IS NOT NULL AND NEW.media_url IS NULL THEN
    NEW.media_url := NEW.attachment_url;
  END IF;

  -- Auto-set receiver_id from chat participants if not provided
  IF NEW.receiver_id IS NULL AND NEW.chat_id IS NOT NULL THEN
    SELECT CASE
      WHEN pc.user_1 = NEW.sender_id THEN pc.user_2
      ELSE pc.user_1
    END INTO NEW.receiver_id
    FROM private_chats pc WHERE pc.id = NEW.chat_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aaa_pm_before_save ON private_messages;
CREATE TRIGGER aaa_pm_before_save
  BEFORE INSERT OR UPDATE ON private_messages
  FOR EACH ROW EXECUTE FUNCTION pm_before_save();

CREATE INDEX IF NOT EXISTS idx_pm_conversation_id ON private_messages(conversation_id);

-- ─── 4. GROUPS: Add missing columns ─────────────────────────────────────────

ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_code text;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS last_message text;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS last_message_at timestamptz;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS disappear_timer text;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Sync invite_code ↔ invite_link
UPDATE groups SET invite_code = invite_link
  WHERE invite_code IS NULL AND invite_link IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_group_invite_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.invite_code := COALESCE(NEW.invite_code, NEW.invite_link);
  NEW.invite_link := COALESCE(NEW.invite_link, NEW.invite_code);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aaa_sync_invite_code ON groups;
CREATE TRIGGER aaa_sync_invite_code
  BEFORE INSERT OR UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION sync_group_invite_code();

-- ─── 5. GROUP_MEMBERS: Add missing columns ───────────────────────────────────

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS muted_until timestamptz;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- ─── 6. GROUP_MESSAGES: Add missing columns ──────────────────────────────────

ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS iv text;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS media_type text;

-- ─── 7. PUSH_SUBSCRIPTIONS: Add missing column ──────────────────────────────

ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_agent text;

-- ─── 8. CALL_SESSIONS table (app needs full call state management) ───────────

CREATE TABLE IF NOT EXISTS call_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  callee_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  call_type        text NOT NULL,
  status           text NOT NULL DEFAULT 'initiated',
  conversation_id  uuid,
  room_id          text,
  initiated_at     timestamptz,
  ringing_at       timestamptz,
  accepted_at      timestamptz,
  ended_at         timestamptz,
  ended_by         uuid,
  end_reason       text,
  duration_seconds integer,
  metadata         jsonb,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "calls_select" ON call_sessions
    FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = callee_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "calls_insert" ON call_sessions
    FOR INSERT WITH CHECK (auth.uid() = caller_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "calls_update" ON call_sessions
    FOR UPDATE USING (auth.uid() = caller_id OR auth.uid() = callee_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_sessions_caller ON call_sessions(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_callee ON call_sessions(callee_id);

-- ─── 9. GROUP_READ_RECEIPTS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_read_receipts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

DO $$ BEGIN
  ALTER TABLE group_read_receipts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "grr_select" ON group_read_receipts FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "grr_insert" ON group_read_receipts FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "grr_update" ON group_read_receipts FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 10. PINNED_MESSAGES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pinned_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL,
  conversation_id uuid,
  group_id        uuid,
  content         text,
  pinned_by       uuid NOT NULL REFERENCES profiles(id),
  message_table   text,
  pinned_at       timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "pin_select" ON pinned_messages FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "pin_insert" ON pinned_messages FOR INSERT WITH CHECK (auth.uid() = pinned_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "pin_delete" ON pinned_messages FOR DELETE USING (auth.uid() = pinned_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 11. PRIVACY_SETTINGS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS privacy_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  last_seen_visibility text DEFAULT 'everyone',
  online_visibility    text DEFAULT 'everyone',
  avatar_visibility    text DEFAULT 'everyone',
  read_receipts        boolean DEFAULT true,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ps_all" ON privacy_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 12. NOTIFICATION_PREFERENCES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scope_id      uuid,
  scope_type    text,
  sound_enabled boolean DEFAULT true,
  sound_name    text,
  vibrate       boolean DEFAULT true,
  show_preview  boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, scope_id)
);

DO $$ BEGIN
  ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "np_all" ON notification_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 13. GROUP_JOIN_REQUESTS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_join_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE group_join_requests ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "gjr_select" ON group_join_requests FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "gjr_insert" ON group_join_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "gjr_update" ON group_join_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_join_requests.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin', 'owner'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 14. USER_PUBLIC_KEYS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_public_keys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id      text,
  public_key     text,
  public_key_jwk text,
  fingerprint    text,
  version        integer DEFAULT 1,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE user_public_keys ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "upk_select" ON user_public_keys FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "upk_insert" ON user_public_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "upk_update" ON user_public_keys FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_upk_user ON user_public_keys(user_id);

-- ─── 15. KEY_RECOVERY ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS key_recovery (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wrapped_key text NOT NULL,
  iv          text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE key_recovery ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "kr_all" ON key_recovery FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 16. ENCRYPTION_AUDIT_LOGS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS encryption_audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,
  device_id  text,
  event      text NOT NULL,
  severity   text,
  details    jsonb,
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE encryption_audit_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "eal_insert" ON encryption_audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "eal_select" ON encryption_audit_logs FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 17. USER_DEVICES (encryption device tracking) ──────────────────────────

CREATE TABLE IF NOT EXISTS user_devices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id          text NOT NULL,
  device_name        text,
  device_type        text,
  platform           text,
  os_version         text,
  screen_resolution  text,
  device_fingerprint text,
  device_info        jsonb,
  is_active          boolean DEFAULT true,
  last_active        timestamptz,
  created_at         timestamptz DEFAULT now(),
  UNIQUE(user_id, device_id)
);

DO $$ BEGIN
  ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ud_all" ON user_devices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 18. REPORTED_USERS view (maps to existing user_reports table) ───────────

DO $$ BEGIN
  CREATE VIEW reported_users AS SELECT * FROM user_reports;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── 19. USER_ROLES ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

DO $$ BEGIN
  ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ur_select" ON user_roles FOR SELECT
    USING (auth.uid() = user_id OR is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 20. FUNCTIONS ───────────────────────────────────────────────────────────

-- can_user_call: check blocks + busy status
CREATE OR REPLACE FUNCTION can_user_call(p_caller_id uuid, p_callee_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = p_callee_id AND blocked_id = p_caller_id)
       OR (blocker_id = p_caller_id AND blocked_id = p_callee_id)
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'blocked');
  END IF;
  IF EXISTS (
    SELECT 1 FROM call_sessions
    WHERE status IN ('initiated','ringing','accepted','in_progress','reconnecting')
      AND (caller_id IN (p_caller_id, p_callee_id)
        OR callee_id IN (p_caller_id, p_callee_id))
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'busy');
  END IF;
  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- get_my_call_history
CREATE OR REPLACE FUNCTION get_my_call_history(p_user_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE (
  call_session_id uuid, call_type text, status text, direction text,
  other_user_id uuid, other_user_name text, other_user_avatar text,
  initiated_at timestamptz, duration_seconds integer, end_reason text
) LANGUAGE sql STABLE AS $$
  SELECT cs.id, cs.call_type, cs.status,
    CASE WHEN cs.caller_id = p_user_id THEN 'outgoing' ELSE 'incoming' END,
    CASE WHEN cs.caller_id = p_user_id THEN cs.callee_id ELSE cs.caller_id END,
    p.full_name, p.avatar_url, cs.initiated_at, cs.duration_seconds, cs.end_reason
  FROM call_sessions cs
  LEFT JOIN profiles p
    ON p.id = CASE WHEN cs.caller_id = p_user_id THEN cs.callee_id ELSE cs.caller_id END
  WHERE cs.caller_id = p_user_id OR cs.callee_id = p_user_id
  ORDER BY cs.created_at DESC LIMIT p_limit;
$$;

-- get_user_group_ids
CREATE OR REPLACE FUNCTION get_user_group_ids(uid uuid)
RETURNS uuid[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(array_agg(group_id), '{}') FROM group_members WHERE user_id = uid;
$$;

-- cleanup_expired_messages
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE d1 int; d2 int;
BEGIN
  DELETE FROM private_messages WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS d1 = ROW_COUNT;
  DELETE FROM group_messages WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS d2 = ROW_COUNT;
  RETURN d1 + d2;
END;
$$;

-- ─── 21. UPDATE handle_new_user trigger (sets user_id = id) ──────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (
    id, user_id, full_name, username, phone, account_type,
    email, account_status, role, status, status_message
  )
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    'user',
    NEW.email,
    'active',
    'user',
    'Hey there! I am using MexiChat',
    'Hey there! I am using MexiChat'
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.id,
    full_name = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name),
    phone = COALESCE(profiles.phone, EXCLUDED.phone),
    email = COALESCE(profiles.email, EXCLUDED.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── 22. GROUP_INVITES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  created_by  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at  timestamptz,
  max_uses    integer,
  use_count   integer DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "gi_select" ON group_invites FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "gi_insert" ON group_invites FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_invites.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin', 'owner'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "gi_update" ON group_invites FOR UPDATE USING (
    EXISTS (SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_invites.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin', 'owner'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_gi_code ON group_invites(invite_code);

-- ─── 23. STARRED_MESSAGES ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS starred_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id    uuid NOT NULL,
  message_table text,
  content       text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, message_id)
);

DO $$ BEGIN
  ALTER TABLE starred_messages ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "sm_all" ON starred_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 24. MESSAGE_REACTIONS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji         text NOT NULL,
  message_table text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

DO $$ BEGIN
  ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "mr_select" ON message_reactions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "mr_insert" ON message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "mr_delete" ON message_reactions FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 25. REALTIME for new tables ─────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE. This migration:
--   • Adds user_id column to profiles (synced with id via trigger)
--   • Creates 'conversations' view on private_chats (auto-updatable)
--   • Adds conversation_id + media_url columns to private_messages (synced)
--   • Auto-sets receiver_id on private_messages INSERT
--   • Adds missing columns to groups, group_members, group_messages
--   • Creates 10 new tables (call_sessions, pinned_messages, etc.)
--   • Creates reported_users view on user_reports
--   • Creates helper functions (can_user_call, get_my_call_history, etc.)
--   • Updates handle_new_user trigger to set user_id
-- ═══════════════════════════════════════════════════════════════════════════════
