-- ═══════════════════════════════════════════════════════════════════════════════
-- ▸▸▸  RUN THIS ON MEXIVANZA's SUPABASE SQL EDITOR  ◂◂◂
-- ▸▸▸  Project: jxhipmpbnihgqbktkggr                ◂◂◂
-- ▸▸▸  NOT on MexiChat's project!                    ◂◂◂
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PURPOSE: Allow MexiChat (external app) to read ALL community data.
--   Ensures open-read RLS policies and realtime publication for the
--   CORRECT tables: user_posts, user_videos, travel_packages, etc.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. OPEN READ RLS policies on all content tables ────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'user_posts','user_videos','profiles','groups',
    'meximart_listings','businesses','travel_packages','empleo_listings'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_public_read" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "allow_public_read" ON %I FOR SELECT USING (true)',
      tbl
    );
  END LOOP;
END $$;

-- ─── 2. ADD tables to realtime publication ──────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'user_posts','user_videos','profiles','groups',
    'meximart_listings','businesses','travel_packages','empleo_listings'
  ] LOOP
    BEGIN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE. This opens read access on:
--   user_posts (487), user_videos (299), travel_packages (176),
--   meximart_listings (183), businesses (17), profiles (443), groups, empleo
-- ═══════════════════════════════════════════════════════════════════════════════
