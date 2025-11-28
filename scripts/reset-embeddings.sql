-- 모든 갤러리 이미지의 embedding을 NULL로 초기화
-- Supabase 대시보드 > SQL Editor에서 실행하세요

UPDATE gallery
SET embedding = NULL,
    gemini_description = NULL,
    gemini_tags = NULL;

-- 결과 확인
SELECT
  COUNT(*) as total,
  COUNT(embedding) as with_embedding,
  COUNT(*) - COUNT(embedding) as without_embedding
FROM gallery;
