ALTER TABLE gallery
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN gallery.thumbnail_url IS
  'Optimized small image URL for gallery list/card previews. Full-size image_url remains the source image.';
