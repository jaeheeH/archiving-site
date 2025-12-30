-- post_views 테이블 생성 (조회수 중복 방지용)
CREATE TABLE IF NOT EXISTS post_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  visitor_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 인덱스 추가 (조회 성능 향상)
  CONSTRAINT unique_recent_view UNIQUE (post_id, visitor_hash)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_created_at ON post_views(created_at);
CREATE INDEX IF NOT EXISTS idx_post_views_hash_time ON post_views(visitor_hash, created_at);

-- 오래된 데이터 자동 삭제 (7일 이상 된 기록 삭제)
-- 선택사항: 주기적으로 실행하거나 cron job으로 설정
-- DELETE FROM post_views WHERE created_at < NOW() - INTERVAL '7 days';

-- RLS (Row Level Security) 활성화
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회 가능 (읽기)
CREATE POLICY "Anyone can view post_views" ON post_views
  FOR SELECT
  USING (true);

-- Service Role만 삽입 가능
CREATE POLICY "Service role can insert post_views" ON post_views
  FOR INSERT
  WITH CHECK (true);
