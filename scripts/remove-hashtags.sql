-- 기존 gemini_tags에서 # 제거
-- Supabase 대시보드 > SQL Editor에서 실행하세요

-- 1. gemini_tags 배열의 모든 요소에서 # 제거
UPDATE gallery
SET gemini_tags = (
  SELECT array_agg(replace(tag, '#', ''))
  FROM unnest(gemini_tags) AS tag
)
WHERE gemini_tags IS NOT NULL
  AND array_length(gemini_tags, 1) > 0;

-- 2. 결과 확인
SELECT
  id,
  title,
  gemini_tags,
  array_length(gemini_tags, 1) as tag_count
FROM gallery
WHERE gemini_tags IS NOT NULL
ORDER BY id
LIMIT 20;

-- 3. 통계 확인
SELECT
  COUNT(*) as total_items,
  COUNT(gemini_tags) as items_with_tags,
  AVG(array_length(gemini_tags, 1)) as avg_tag_count
FROM gallery;
