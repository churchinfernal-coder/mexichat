-- Contact Hashes table for privacy-preserving contact discovery
-- Only SHA-256 hashes are stored, never raw phone numbers or emails

CREATE TABLE IF NOT EXISTS public.contact_hashes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hash text NOT NULL,
  contact_type text NOT NULL CHECK (contact_type IN ('phone', 'email')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, hash)
);

-- Index for fast lookup during discovery
CREATE INDEX IF NOT EXISTS idx_contact_hashes_hash ON public.contact_hashes(hash);
CREATE INDEX IF NOT EXISTS idx_contact_hashes_user ON public.contact_hashes(user_id);

-- Add own_hash column to profiles for reverse discovery
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS own_hash text;
CREATE INDEX IF NOT EXISTS idx_profiles_own_hash ON public.profiles(own_hash);

-- RLS: users can only read/write their own hashes
ALTER TABLE public.contact_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own hashes"
  ON public.contact_hashes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read all hashes for discovery"
  ON public.contact_hashes FOR SELECT
  USING (true);

CREATE POLICY "Users can delete own hashes"
  ON public.contact_hashes FOR DELETE
  USING (auth.uid() = user_id);