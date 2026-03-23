-- ═══════════════════════════════════════════════════════════════════════════════
-- MexiChat — Fix Migration: Storage Buckets + Core RLS + Realtime
-- The original 00001 schema was never applied (DO_NOT_RUN). This migration
-- backfills: storage buckets, storage policies, core table RLS, realtime pubs,
-- and the handle_new_user trigger.
-- Safe to re-run (all idempotent).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. STORAGE BUCKETS ─────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880,
    ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('chat-media', 'chat-media', false, 52428800,
    ARRAY['image/jpeg','image/png','image/webp','image/gif',
          'video/mp4','video/quicktime',
          'audio/webm','audio/ogg','audio/mp4','audio/mpeg']),
  ('group-avatars', 'group-avatars', true, 5242880,
    ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ─── 2. STORAGE POLICIES ────────────────────────────────────────────────────

-- Avatars: public read, owner write
DO $$ BEGIN
  CREATE POLICY "avatars_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_write" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Chat-media: authenticated users can upload and read
DO $$ BEGIN
  CREATE POLICY "chatmedia_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "chatmedia_select" ON storage.objects FOR SELECT
    USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "chatmedia_update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "chatmedia_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Group-avatars: public read, authenticated write
DO $$ BEGIN
  CREATE POLICY "groupavatars_read" ON storage.objects FOR SELECT
    USING (bucket_id = 'group-avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "groupavatars_write" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'group-avatars' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "groupavatars_update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'group-avatars' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. CORE TABLE RLS ─────────────────────────────────────────────────────

-- Dynamically drop ALL existing policies on critical tables (handles any naming scheme)
DO $$
DECLARE
  _tbl TEXT;
  _pol TEXT;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'profiles','private_chats','private_messages',
    'groups','group_members','group_messages',
    'contacts','blocked_users','push_subscriptions',
    'user_devices','user_public_keys',
    'call_sessions','message_reactions',
    'group_invites','group_join_requests',
    'pinned_messages','starred_messages',
    'privacy_settings','notification_preferences','key_recovery'
  ] LOOP
    FOR _pol IN
      SELECT policyname FROM pg_policies WHERE tablename = _tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', _pol, _tbl);
    END LOOP;
  END LOOP;
END $$;

-- Profiles: anyone can read, owner can update
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Private chats (underlying table for 'conversations' view)
ALTER TABLE private_chats ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "pc_select" ON private_chats FOR SELECT
    USING (auth.uid() = user_1 OR auth.uid() = user_2);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pc_insert" ON private_chats FOR INSERT
    WITH CHECK (auth.uid() = user_1 OR auth.uid() = user_2);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pc_update" ON private_chats FOR UPDATE
    USING (auth.uid() = user_1 OR auth.uid() = user_2);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pc_delete" ON private_chats FOR DELETE
    USING (auth.uid() = user_1 OR auth.uid() = user_2);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Private messages
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "pm_select" ON private_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM private_chats c
      WHERE c.id = private_messages.conversation_id
        AND (c.user_1 = auth.uid() OR c.user_2 = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM private_chats c
      WHERE c.id = private_messages.chat_id
        AND (c.user_1 = auth.uid() OR c.user_2 = auth.uid())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pm_insert" ON private_messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pm_update" ON private_messages FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM private_chats c
      WHERE c.id = private_messages.conversation_id
        AND (c.user_1 = auth.uid() OR c.user_2 = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM private_chats c
      WHERE c.id = private_messages.chat_id
        AND (c.user_1 = auth.uid() OR c.user_2 = auth.uid())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pm_delete" ON private_messages FOR DELETE USING (
    auth.uid() = sender_id
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "groups_select" ON groups FOR SELECT USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = id AND gm.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "groups_insert" ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "groups_update" ON groups FOR UPDATE USING (
    EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = id AND gm.user_id = auth.uid() AND gm.role IN ('admin', 'owner'))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Group members (IMPORTANT: avoid self-referencing SELECT policy to prevent infinite recursion)
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "gm_select" ON group_members FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gm_insert" ON group_members FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gm_delete" ON group_members FOR DELETE USING (
    auth.uid() = user_id
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gm_update" ON group_members FOR UPDATE USING (
    auth.role() = 'authenticated'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Group messages
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "gmsg_select" ON group_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gmsg_insert" ON group_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gmsg_update" ON group_messages FOR UPDATE USING (
    auth.uid() = sender_id
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gmsg_delete" ON group_messages FOR DELETE USING (
    auth.uid() = sender_id
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Contacts
DO $$ BEGIN ALTER TABLE contacts ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "contacts_select" ON contacts FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "contacts_insert" ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "contacts_delete" ON contacts FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Blocked users
DO $$ BEGIN ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "blocked_select" ON blocked_users FOR SELECT USING (auth.uid() = blocker_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "blocked_insert" ON blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "blocked_delete" ON blocked_users FOR DELETE USING (auth.uid() = blocker_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Push subscriptions
DO $$ BEGIN ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "push_select" ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "push_insert" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "push_update" ON push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "push_delete" ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User devices
DO $$ BEGIN ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "devices_select" ON user_devices FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "devices_insert" ON user_devices FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "devices_update" ON user_devices FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- E2EE public keys
DO $$ BEGIN ALTER TABLE user_public_keys ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pubkeys_select" ON user_public_keys FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pubkeys_insert" ON user_public_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pubkeys_update" ON user_public_keys FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Telemetry (table may not exist in legacy DB)
DO $$ BEGIN
  ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "telemetry_insert" ON telemetry_events FOR INSERT WITH CHECK (true);
EXCEPTION WHEN others THEN NULL; END $$;

-- Call sessions (required for voice/video calls)
DO $$ BEGIN ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "calls_select" ON call_sessions FOR SELECT
    USING (auth.uid() = caller_id OR auth.uid() = callee_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "calls_insert" ON call_sessions FOR INSERT
    WITH CHECK (auth.uid() = caller_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "calls_update" ON call_sessions FOR UPDATE
    USING (auth.uid() = caller_id OR auth.uid() = callee_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Message reactions (emojis)
DO $$ BEGIN ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "reactions_select" ON message_reactions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "reactions_insert" ON message_reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "reactions_delete" ON message_reactions FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Group invites (table may not exist)
DO $$ BEGIN ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ginvites_select" ON group_invites FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ginvites_insert" ON group_invites FOR INSERT WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ginvites_update" ON group_invites FOR UPDATE USING (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Group join requests (table may not exist)
DO $$ BEGIN ALTER TABLE group_join_requests ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gjoin_select" ON group_join_requests FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gjoin_insert" ON group_join_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gjoin_update" ON group_join_requests FOR UPDATE USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pinned messages (table may not exist)
DO $$ BEGIN ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pinned_select" ON pinned_messages FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pinned_insert" ON pinned_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pinned_delete" ON pinned_messages FOR DELETE USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Starred messages (table may not exist)
DO $$ BEGIN ALTER TABLE starred_messages ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "starred_select" ON starred_messages FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "starred_insert" ON starred_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "starred_delete" ON starred_messages FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Privacy settings (table may not exist)
DO $$ BEGIN ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "privacy_select" ON privacy_settings FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "privacy_upsert" ON privacy_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "privacy_update" ON privacy_settings FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notification preferences (table may not exist)
DO $$ BEGIN ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "notifpref_select" ON notification_preferences FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "notifpref_upsert" ON notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "notifpref_update" ON notification_preferences FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Key recovery (table may not exist)
DO $$ BEGIN ALTER TABLE key_recovery ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "keyrecovery_select" ON key_recovery FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "keyrecovery_upsert" ON key_recovery FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "keyrecovery_update" ON key_recovery FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Read receipts for groups (table may not exist)
DO $$ BEGIN ALTER TABLE group_read_receipts ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "grr_select" ON group_read_receipts FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "grr_insert" ON group_read_receipts FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "grr_update" ON group_read_receipts FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 4. REALTIME PUBLICATIONS ───────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE private_chats;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE groups;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_sessions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 5. FIX handle_new_user TRIGGER ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, user_id, full_name, username, phone, account_type,
    email, account_status, role, status, status_message
  )
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    'user',
    NEW.email,
    'active',
    'user',
    'Hey there! I am using MexiChat',
    'Hey there! I am using MexiChat'
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id      = EXCLUDED.user_id,
    full_name    = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    phone        = COALESCE(public.profiles.phone, EXCLUDED.phone),
    email        = COALESCE(public.profiles.email, EXCLUDED.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── 6. FIX pm_before_save TRIGGER (must be SECURITY DEFINER to read private_chats through RLS) ──

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

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE. This migration fixes:
--   • Creates 3 storage buckets (avatars, chat-media, group-avatars)
--   • Adds storage RLS policies (public read for avatars, auth for chat-media)
--   • Enables RLS + policies on all core tables (no infinite recursion)
--   • Adds realtime publication for core tables
--   • Fixes handle_new_user trigger with all required columns
--   • Fixes pm_before_save trigger to SECURITY DEFINER (reads through RLS)
-- ═══════════════════════════════════════════════════════════════════════════════
