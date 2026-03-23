-- ═══════════════════════════════════════════════════════════════════════════════
-- ▸▸▸  RUN THIS ON MEXIVANZA's SUPABASE SQL EDITOR  ◂◂◂
-- ▸▸▸  Project: jxhipmpbnihgqbktkggr                ◂◂◂
-- ▸▸▸  NOT on MexiChat's project!                    ◂◂◂
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PURPOSE: Create the full interaction layer for videos & posts:
--   - Interaction tables: video_likes, post_likes, video_comments, post_comments, video_shares, post_shares, video_views, post_views
--   - RPC functions: toggle_like, add_comment, record_view, record_share
--   - Triggers: auto-sync counts back to user_videos / user_posts
--   - RLS: auth'd users can write, public can read
--   - Realtime: all tables published for live updates
--   - Rate limiting via unique constraints & dedup windows
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. INTERACTION TABLES ──────────────────────────────────────────────────

-- VIDEO LIKES
CREATE TABLE IF NOT EXISTS video_likes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id    uuid NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, video_id)
);

-- POST LIKES
CREATE TABLE IF NOT EXISTS post_likes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id     uuid NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, post_id)
);

-- VIDEO COMMENTS
CREATE TABLE IF NOT EXISTS video_comments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id    uuid NOT NULL,
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- POST COMMENTS
CREATE TABLE IF NOT EXISTS post_comments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id     uuid NOT NULL,
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- VIDEO VIEWS (deduplicated per user per video per hour)
CREATE TABLE IF NOT EXISTS video_views (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid,  -- NULL for anonymous views
  video_id    uuid NOT NULL,
  viewed_at   timestamptz DEFAULT now() NOT NULL
);

-- POST VIEWS
CREATE TABLE IF NOT EXISTS post_views (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid,
  post_id     uuid NOT NULL,
  viewed_at   timestamptz DEFAULT now() NOT NULL
);

-- VIDEO SHARES
CREATE TABLE IF NOT EXISTS video_shares (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id    uuid NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- POST SHARES
CREATE TABLE IF NOT EXISTS post_shares (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id     uuid NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- ─── 2. INDEXES ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_video_likes_video ON video_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_user  ON video_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post   ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user   ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_video_comments_video ON video_comments(video_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post   ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_video_views_video ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_dedup ON video_views(user_id, video_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_post_views_post   ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_video_shares_video ON video_shares(video_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_post   ON post_shares(post_id);

-- ─── 3. RLS POLICIES ───────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'video_likes','post_likes','video_comments','post_comments',
    'video_views','post_views','video_shares','post_shares'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Public read
    EXECUTE format('DROP POLICY IF EXISTS "allow_public_read" ON %I', tbl);
    EXECUTE format('CREATE POLICY "allow_public_read" ON %I FOR SELECT USING (true)', tbl);

    -- Auth'd insert
    EXECUTE format('DROP POLICY IF EXISTS "allow_auth_insert" ON %I', tbl);
    EXECUTE format('CREATE POLICY "allow_auth_insert" ON %I FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)', tbl);

    -- Own row delete (for unlike)
    EXECUTE format('DROP POLICY IF EXISTS "allow_own_delete" ON %I', tbl);
    EXECUTE format('CREATE POLICY "allow_own_delete" ON %I FOR DELETE USING (auth.uid() = user_id)', tbl);
  END LOOP;
END $$;

-- ─── 4. REALTIME PUBLICATION ────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'video_likes','post_likes','video_comments','post_comments',
    'video_views','post_views','video_shares','post_shares'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ─── 5. COUNT-SYNC TRIGGERS ────────────────────────────────────────────────
-- These triggers keep the denormalized counts on user_videos/user_posts in sync.

-- 5a. video_likes → user_videos.likes_count
CREATE OR REPLACE FUNCTION sync_video_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE target uuid;
BEGIN
  target := COALESCE(NEW.video_id, OLD.video_id);
  UPDATE user_videos SET likes_count = (
    SELECT count(*) FROM video_likes WHERE video_id = target
  ) WHERE id = target;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_video_likes ON video_likes;
CREATE TRIGGER trg_sync_video_likes
  AFTER INSERT OR DELETE ON video_likes
  FOR EACH ROW EXECUTE FUNCTION sync_video_likes_count();

-- 5b. post_likes → user_posts.likes_count
CREATE OR REPLACE FUNCTION sync_post_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE target uuid;
BEGIN
  target := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE user_posts SET likes_count = (
    SELECT count(*) FROM post_likes WHERE post_id = target
  ) WHERE id = target;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_post_likes ON post_likes;
CREATE TRIGGER trg_sync_post_likes
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION sync_post_likes_count();

-- 5c. video_comments → user_videos.comments_count
CREATE OR REPLACE FUNCTION sync_video_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE target uuid;
BEGIN
  target := COALESCE(NEW.video_id, OLD.video_id);
  UPDATE user_videos SET comments_count = (
    SELECT count(*) FROM video_comments WHERE video_id = target
  ) WHERE id = target;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_video_comments ON video_comments;
CREATE TRIGGER trg_sync_video_comments
  AFTER INSERT OR DELETE ON video_comments
  FOR EACH ROW EXECUTE FUNCTION sync_video_comments_count();

-- 5d. post_comments → user_posts.comments_count
CREATE OR REPLACE FUNCTION sync_post_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE target uuid;
BEGIN
  target := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE user_posts SET comments_count = (
    SELECT count(*) FROM post_comments WHERE post_id = target
  ) WHERE id = target;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_post_comments ON post_comments;
CREATE TRIGGER trg_sync_post_comments
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION sync_post_comments_count();

-- 5e. video_views → user_videos.views_count
CREATE OR REPLACE FUNCTION sync_video_views_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE user_videos SET views_count = (
    SELECT count(*) FROM video_views WHERE video_id = NEW.video_id
  ) WHERE id = NEW.video_id;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_video_views ON video_views;
CREATE TRIGGER trg_sync_video_views
  AFTER INSERT ON video_views
  FOR EACH ROW EXECUTE FUNCTION sync_video_views_count();

-- 5f. post_views → user_posts.view_count (note: some schemas use view_count, some views_count)
CREATE OR REPLACE FUNCTION sync_post_views_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Try both column names for compatibility
  BEGIN
    UPDATE user_posts SET views_count = (
      SELECT count(*) FROM post_views WHERE post_id = NEW.post_id
    ) WHERE id = NEW.post_id;
  EXCEPTION WHEN undefined_column THEN
    UPDATE user_posts SET view_count = (
      SELECT count(*) FROM post_views WHERE post_id = NEW.post_id
    ) WHERE id = NEW.post_id;
  END;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_post_views ON post_views;
CREATE TRIGGER trg_sync_post_views
  AFTER INSERT ON post_views
  FOR EACH ROW EXECUTE FUNCTION sync_post_views_count();

-- 5g. video_shares → user_videos.shares_count
CREATE OR REPLACE FUNCTION sync_video_shares_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE user_videos SET shares_count = (
    SELECT count(*) FROM video_shares WHERE video_id = NEW.video_id
  ) WHERE id = NEW.video_id;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_video_shares ON video_shares;
CREATE TRIGGER trg_sync_video_shares
  AFTER INSERT ON video_shares
  FOR EACH ROW EXECUTE FUNCTION sync_video_shares_count();

-- 5h. post_shares → user_posts.shares_count
CREATE OR REPLACE FUNCTION sync_post_shares_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE user_posts SET shares_count = (
    SELECT count(*) FROM post_shares WHERE post_id = NEW.post_id
  ) WHERE id = NEW.post_id;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_post_shares ON post_shares;
CREATE TRIGGER trg_sync_post_shares
  AFTER INSERT ON post_shares
  FOR EACH ROW EXECUTE FUNCTION sync_post_shares_count();

-- ─── 6. RPC FUNCTIONS ──────────────────────────────────────────────────────

-- 6a. Toggle video like (idempotent — like if not liked, unlike if already liked)
CREATE OR REPLACE FUNCTION toggle_video_like(p_video_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid;
  _new_count int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT id INTO _existing FROM video_likes
    WHERE user_id = _uid AND video_id = p_video_id;

  IF _existing IS NOT NULL THEN
    DELETE FROM video_likes WHERE id = _existing;
    SELECT count(*) INTO _new_count FROM video_likes WHERE video_id = p_video_id;
    RETURN json_build_object('liked', false, 'count', _new_count);
  ELSE
    INSERT INTO video_likes (user_id, video_id) VALUES (_uid, p_video_id);
    SELECT count(*) INTO _new_count FROM video_likes WHERE video_id = p_video_id;
    RETURN json_build_object('liked', true, 'count', _new_count);
  END IF;
END;$$;

-- 6b. Toggle post like
CREATE OR REPLACE FUNCTION toggle_post_like(p_post_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid;
  _new_count int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT id INTO _existing FROM post_likes
    WHERE user_id = _uid AND post_id = p_post_id;

  IF _existing IS NOT NULL THEN
    DELETE FROM post_likes WHERE id = _existing;
    SELECT count(*) INTO _new_count FROM post_likes WHERE post_id = p_post_id;
    RETURN json_build_object('liked', false, 'count', _new_count);
  ELSE
    INSERT INTO post_likes (user_id, post_id) VALUES (_uid, p_post_id);
    SELECT count(*) INTO _new_count FROM post_likes WHERE post_id = p_post_id;
    RETURN json_build_object('liked', true, 'count', _new_count);
  END IF;
END;$$;

-- 6c. Add video comment (rate-limited: max 1 comment per 3 seconds per user per video)
CREATE OR REPLACE FUNCTION add_video_comment(p_video_id uuid, p_content text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid uuid := auth.uid();
  _recent int;
  _comment_id uuid;
  _new_count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF char_length(trim(p_content)) < 1 OR char_length(p_content) > 2000 THEN
    RAISE EXCEPTION 'INVALID_CONTENT';
  END IF;

  -- Rate limit: no more than 1 comment per 3s on same video
  SELECT count(*) INTO _recent FROM video_comments
    WHERE user_id = _uid AND video_id = p_video_id
    AND created_at > now() - interval '3 seconds';
  IF _recent > 0 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  INSERT INTO video_comments (user_id, video_id, content)
    VALUES (_uid, p_video_id, trim(p_content))
    RETURNING id INTO _comment_id;

  SELECT count(*) INTO _new_count FROM video_comments WHERE video_id = p_video_id;
  RETURN json_build_object('comment_id', _comment_id, 'count', _new_count);
END;$$;

-- 6d. Add post comment
CREATE OR REPLACE FUNCTION add_post_comment(p_post_id uuid, p_content text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid uuid := auth.uid();
  _recent int;
  _comment_id uuid;
  _new_count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF char_length(trim(p_content)) < 1 OR char_length(p_content) > 2000 THEN
    RAISE EXCEPTION 'INVALID_CONTENT';
  END IF;

  SELECT count(*) INTO _recent FROM post_comments
    WHERE user_id = _uid AND post_id = p_post_id
    AND created_at > now() - interval '3 seconds';
  IF _recent > 0 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;

  INSERT INTO post_comments (user_id, post_id, content)
    VALUES (_uid, p_post_id, trim(p_content))
    RETURNING id INTO _comment_id;

  SELECT count(*) INTO _new_count FROM post_comments WHERE post_id = p_post_id;
  RETURN json_build_object('comment_id', _comment_id, 'count', _new_count);
END;$$;

-- 6e. Record video view (deduplicated: same user, same video, max 1 per 30min)
CREATE OR REPLACE FUNCTION record_video_view(p_video_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid uuid := auth.uid();
  _recent int;
  _new_count int;
BEGIN
  -- Dedup: same user+video within 30min
  IF _uid IS NOT NULL THEN
    SELECT count(*) INTO _recent FROM video_views
      WHERE user_id = _uid AND video_id = p_video_id
      AND viewed_at > now() - interval '30 minutes';
    IF _recent > 0 THEN
      SELECT count(*) INTO _new_count FROM video_views WHERE video_id = p_video_id;
      RETURN json_build_object('recorded', false, 'count', _new_count);
    END IF;
  END IF;

  INSERT INTO video_views (user_id, video_id) VALUES (_uid, p_video_id);
  SELECT count(*) INTO _new_count FROM video_views WHERE video_id = p_video_id;
  RETURN json_build_object('recorded', true, 'count', _new_count);
END;$$;

-- 6f. Record post view
CREATE OR REPLACE FUNCTION record_post_view(p_post_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid uuid := auth.uid();
  _recent int;
  _new_count int;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT count(*) INTO _recent FROM post_views
      WHERE user_id = _uid AND post_id = p_post_id
      AND viewed_at > now() - interval '30 minutes';
    IF _recent > 0 THEN
      SELECT count(*) INTO _new_count FROM post_views WHERE post_id = p_post_id;
      RETURN json_build_object('recorded', false, 'count', _new_count);
    END IF;
  END IF;

  INSERT INTO post_views (user_id, post_id) VALUES (_uid, p_post_id);
  SELECT count(*) INTO _new_count FROM post_views WHERE post_id = p_post_id;
  RETURN json_build_object('recorded', true, 'count', _new_count);
END;$$;

-- 6g. Record video share
CREATE OR REPLACE FUNCTION record_video_share(p_video_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  INSERT INTO video_shares (user_id, video_id) VALUES (_uid, p_video_id);
  SELECT count(*) INTO _new_count FROM video_shares WHERE video_id = p_video_id;
  RETURN json_build_object('count', _new_count);
END;$$;

-- 6h. Record post share
CREATE OR REPLACE FUNCTION record_post_share(p_post_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  INSERT INTO post_shares (user_id, post_id) VALUES (_uid, p_post_id);
  SELECT count(*) INTO _new_count FROM post_shares WHERE post_id = p_post_id;
  RETURN json_build_object('count', _new_count);
END;$$;

-- 6i. Fetch comments for a video (paginated)
CREATE OR REPLACE FUNCTION get_video_comments(p_video_id uuid, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO _result FROM (
    SELECT vc.id, vc.content, vc.created_at, vc.user_id,
           p.full_name, p.username, p.avatar_url
    FROM video_comments vc
    LEFT JOIN profiles p ON p.id = vc.user_id
    WHERE vc.video_id = p_video_id
    ORDER BY vc.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(_result, '[]'::json);
END;$$;

-- 6j. Fetch comments for a post
CREATE OR REPLACE FUNCTION get_post_comments(p_post_id uuid, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO _result FROM (
    SELECT pc.id, pc.content, pc.created_at, pc.user_id,
           p.full_name, p.username, p.avatar_url
    FROM post_comments pc
    LEFT JOIN profiles p ON p.id = pc.user_id
    WHERE pc.post_id = p_post_id
    ORDER BY pc.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(_result, '[]'::json);
END;$$;

-- 6k. Check if current user has liked a video
CREATE OR REPLACE FUNCTION check_video_liked(p_video_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM video_likes WHERE user_id = auth.uid() AND video_id = p_video_id
  );
END;$$;

-- 6l. Check if current user has liked a post
CREATE OR REPLACE FUNCTION check_post_liked(p_post_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM post_likes WHERE user_id = auth.uid() AND post_id = p_post_id
  );
END;$$;

-- 6m. Batch check likes for multiple videos (for feed rendering)
CREATE OR REPLACE FUNCTION check_videos_liked(p_video_ids uuid[])
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid uuid := auth.uid();
  _result json;
BEGIN
  IF _uid IS NULL THEN RETURN '[]'::json; END IF;
  SELECT json_agg(video_id) INTO _result
    FROM video_likes
    WHERE user_id = _uid AND video_id = ANY(p_video_ids);
  RETURN COALESCE(_result, '[]'::json);
END;$$;

-- 6n. Batch check likes for multiple posts
CREATE OR REPLACE FUNCTION check_posts_liked(p_post_ids uuid[])
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _uid uuid := auth.uid();
  _result json;
BEGIN
  IF _uid IS NULL THEN RETURN '[]'::json; END IF;
  SELECT json_agg(post_id) INTO _result
    FROM post_likes
    WHERE user_id = _uid AND post_id = ANY(p_post_ids);
  RETURN COALESCE(_result, '[]'::json);
END;$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE. Run this on MexiVanza (jxhipmpbnihgqbktkggr) SQL Editor.
-- After running, all interaction RPCs are available via the MexiVanza client:
--   mexivanza.rpc('toggle_video_like', { p_video_id })
--   mexivanza.rpc('toggle_post_like', { p_post_id })
--   mexivanza.rpc('add_video_comment', { p_video_id, p_content })
--   mexivanza.rpc('record_video_view', { p_video_id })
--   mexivanza.rpc('record_video_share', { p_video_id })
--   mexivanza.rpc('get_video_comments', { p_video_id })
--   mexivanza.rpc('check_video_liked', { p_video_id })
--   mexivanza.rpc('check_videos_liked', { p_video_ids })
-- Realtime updates flow automatically via triggers → user_videos/user_posts
-- count updates → existing realtime subscriptions in MexiChat.
-- ═══════════════════════════════════════════════════════════════════════════════
