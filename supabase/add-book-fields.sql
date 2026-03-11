-- books 테이블에 새 필드 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE books ADD COLUMN IF NOT EXISTS reading_status TEXT DEFAULT 'to_read' CHECK (reading_status IN ('to_read', 'reading', 'finished', 'dropped'));
ALTER TABLE books ADD COLUMN IF NOT EXISTS started_at DATE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS finished_at DATE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS current_page INT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_pages INT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS rating FLOAT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS one_liner TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- 기존 데이터 마이그레이션: phase 기반으로 reading_status 설정
UPDATE books SET reading_status = 'reading' WHERE phase IN (0, 1, 2) AND reading_status = 'to_read';
UPDATE books SET reading_status = 'finished' WHERE (phase = 3 OR has_review = true) AND reading_status = 'to_read';
