-- Gallery view tracking.
-- Run this in Supabase SQL Editor before relying on gallery view analytics.

ALTER TABLE gallery
ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN gallery.view_count IS
  'Cached public view count for gallery detail pages. Incremented by /api/gallery/[id]/view.';

CREATE TABLE IF NOT EXISTS gallery_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gallery_id INTEGER NOT NULL REFERENCES gallery(id) ON DELETE CASCADE,
  user_id UUID NULL,
  visitor_hash VARCHAR(64) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If gallery_views already existed from an earlier draft, CREATE TABLE IF NOT EXISTS
-- will not add missing columns. Keep the migration safe to re-run.
ALTER TABLE gallery_views
ADD COLUMN IF NOT EXISTS gallery_id INTEGER REFERENCES gallery(id) ON DELETE CASCADE;

ALTER TABLE gallery_views
ADD COLUMN IF NOT EXISTS user_id UUID NULL;

ALTER TABLE gallery_views
ADD COLUMN IF NOT EXISTS visitor_hash VARCHAR(64) NULL;

ALTER TABLE gallery_views
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_gallery_views_gallery_id ON gallery_views(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_views_user_time ON gallery_views(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gallery_views_hash_time ON gallery_views(visitor_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_gallery_views_created_at ON gallery_views(created_at);

ALTER TABLE gallery_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view gallery_views" ON gallery_views;
DROP POLICY IF EXISTS "Service role can insert gallery_views" ON gallery_views;

-- No public RLS policy is needed. The application reads/writes this table
-- through the Supabase service role in API routes.

-- Optional maintenance:
-- DELETE FROM gallery_views WHERE created_at < NOW() - INTERVAL '30 days';
