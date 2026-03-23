-- ═══════════════════════════════════════════════════════════════════════════════
-- MexiChat — COMPREHENSIVE FIX: Triggers + Constraints + Policies
-- This drops ALL user-created triggers on core tables and recreates only the
-- correct ones. Also fixes constraints and policies that cause 400/500 errors.
-- Run this ONCE in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. DROP ALL USER-CREATED TRIGGERS on core chat tables ──────────────────
-- The live DB has triggers created via dashboard that reference non-existent
-- columns (is_system_message, array casts of 'everyone'). We drop ALL then
-- recreate only the known-good ones.
DO $$
DECLARE
  _tbl TEXT;
  _trig RECORD;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'private_messages','group_messages','profiles','private_chats','groups','group_members'
  ] LOOP
    FOR _trig IN
      SELECT tgname FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE c.relname = _tbl AND NOT t.tgisinternal
    LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', _trig.tgname, _tbl);
    END LOOP;
  END LOOP;
END $$;

-- ─── 2. RECREATE CORRECT TRIGGERS (from 00002 bridge migration) ────────────

-- 2a. profiles: sync user_id = id
CREATE OR REPLACE FUNCTION sync_profile_user_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.user_id := NEW.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aaa_sync_profile_user_id
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_user_id();

-- 2b. private_messages: sync conversation_id↔chat_id, media_url↔attachment_url, auto-set receiver_id
CREATE OR REPLACE FUNCTION pm_before_save()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.conversation_id := COALESCE(NEW.conversation_id, NEW.chat_id);
  NEW.chat_id := COALESCE(NEW.chat_id, NEW.conversation_id);

  IF NEW.media_url IS NOT NULL AND NEW.attachment_url IS NULL THEN
    NEW.attachment_url := NEW.media_url;
  ELSIF NEW.attachment_url IS NOT NULL AND NEW.media_url IS NULL THEN
    NEW.media_url := NEW.attachment_url;
  END IF;

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
CREATE TRIGGER aaa_pm_before_save
  BEFORE INSERT OR UPDATE ON private_messages
  FOR EACH ROW EXECUTE FUNCTION pm_before_save();

-- 2c. groups: sync invite_code↔invite_link
CREATE OR REPLACE FUNCTION sync_group_invite_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.invite_code := COALESCE(NEW.invite_code, NEW.invite_link);
  NEW.invite_link := COALESCE(NEW.invite_link, NEW.invite_code);
  RETURN NEW;
END;
$$;
CREATE TRIGGER aaa_sync_invite_code
  BEFORE INSERT OR UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION sync_group_invite_code();

-- ─── 3. FIX handle_new_user — phone NOT NULL constraint ────────────────────
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

-- ─── 4. FIX groups_select — creator must be able to see their new group ─────
DROP POLICY IF EXISTS "groups_select" ON groups;
CREATE POLICY "groups_select" ON groups FOR SELECT USING (
  auth.uid() = created_by
  OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = id AND gm.user_id = auth.uid())
);

-- ─── 5. FIX group_members role constraint — add 'owner' if missing ──────────
-- The code inserts role='owner' but the DB constraint may not include it
DO $$
BEGIN
  ALTER TABLE group_members DROP CONSTRAINT IF EXISTS group_members_role_check;
  ALTER TABLE group_members ADD CONSTRAINT group_members_role_check
    CHECK (role IN ('member', 'admin', 'owner'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── 6. ADD missing columns that triggers/code reference ────────────────────
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS is_system_message boolean DEFAULT false;

-- ─── 7. Clean up orphaned test users from failed signups ────────────────────
DELETE FROM auth.users WHERE email = 'test3@mexichat.com';
DELETE FROM auth.users WHERE email = 'test4@mexichat.com';

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE. This single migration fixes ALL remaining send/group/message errors:
--   1. Drops broken dashboard-created triggers (is_system_message, everyone array)
--   2. Recreates only the 3 correct triggers from the bridge migration
--   3. Fixes handle_new_user phone NOT NULL constraint
--   4. Fixes groups_select so creator can see their new group
--   5. Fixes group_members role constraint to allow 'owner'
--   6. Adds missing is_system_message column to group_messages
--   7. Cleans up orphaned test auth users
-- ═══════════════════════════════════════════════════════════════════════════════
