-- 소장 방식 + 대출 정보 + 전자책 플랫폼 + 독서 기간
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE books ADD COLUMN IF NOT EXISTS ownership_type TEXT DEFAULT 'owned';
ALTER TABLE books ADD COLUMN IF NOT EXISTS borrowed_at DATE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS loan_days INT DEFAULT 14;
ALTER TABLE books ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS borrowed_from TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS ebook_platform TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS reading_days INT;
