-- books 테이블에 컨텍스트 준비 상태 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- (add-context-cache.sql 먼저 실행 후 이것을 실행)

ALTER TABLE books ADD COLUMN IF NOT EXISTS context_status TEXT;
