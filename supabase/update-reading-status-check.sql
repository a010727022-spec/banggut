-- supabase/update-reading-status-check.sql
-- reading_status CHECK 제약에 want_to_read, abandoned 추가
-- (기존: to_read, reading, finished, dropped)

ALTER TABLE books
  DROP CONSTRAINT IF EXISTS books_reading_status_check;

ALTER TABLE books
  ADD CONSTRAINT books_reading_status_check
  CHECK (reading_status IN ('to_read', 'want_to_read', 'reading', 'finished', 'dropped', 'abandoned'));
