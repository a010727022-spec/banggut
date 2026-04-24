-- supabase/add-is-favorite.sql
-- 책 즐겨찾기(하트) 필드

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_books_user_favorite
  ON books(user_id, is_favorite)
  WHERE is_favorite = TRUE;
