-- Store Studio generation controls separately from the final prompt string.
-- Safe to run multiple times in Supabase SQL Editor.

ALTER TABLE generated_images
ADD COLUMN IF NOT EXISTS subject_prompt TEXT;

ALTER TABLE generated_images
ADD COLUMN IF NOT EXISTS lighting TEXT;

ALTER TABLE generated_images
ADD COLUMN IF NOT EXISTS camera TEXT;

ALTER TABLE generated_images
ADD COLUMN IF NOT EXISTS vibe TEXT;

ALTER TABLE generated_images
ADD COLUMN IF NOT EXISTS background TEXT;

ALTER TABLE generated_images
ADD COLUMN IF NOT EXISTS prompt_mode TEXT DEFAULT 'composed';

COMMENT ON COLUMN generated_images.prompt IS
  'Final prompt sent to the image model.';

COMMENT ON COLUMN generated_images.subject_prompt IS
  'Raw subject prompt entered in Studio before option composition.';

COMMENT ON COLUMN generated_images.lighting IS
  'Studio lighting option used for generation.';

COMMENT ON COLUMN generated_images.camera IS
  'Studio camera option used for generation.';

COMMENT ON COLUMN generated_images.vibe IS
  'Studio mood/vibe option used for generation.';

COMMENT ON COLUMN generated_images.background IS
  'Studio background option used for generation.';

COMMENT ON COLUMN generated_images.prompt_mode IS
  'composed when Studio options were combined, imported when a full prompt was reused.';

-- Ask PostgREST/Supabase API to refresh its schema cache after adding columns.
NOTIFY pgrst, 'reload schema';
