-- scraps 테이블에 book_id, page_number 필드 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE scraps ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE scraps ADD COLUMN IF NOT EXISTS page_number INT;

-- 기존 scraps의 book_title이 books의 title과 매칭되면 book_id 자동 연결
UPDATE scraps s
SET book_id = b.id
FROM books b
WHERE s.book_title = b.title
  AND s.user_id = b.user_id
  AND s.book_id IS NULL;
