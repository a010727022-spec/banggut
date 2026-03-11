-- books 테이블에 책 컨텍스트 캐싱 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE books ADD COLUMN IF NOT EXISTS context_data JSONB;
ALTER TABLE books ADD COLUMN IF NOT EXISTS context_fetched_at TIMESTAMPTZ;
