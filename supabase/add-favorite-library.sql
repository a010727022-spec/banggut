-- supabase/add-favorite-library.sql
-- 사용자가 자주 가는 도서관 (도서관 정보나루 API 연동용)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS favorite_library_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS favorite_library_name TEXT DEFAULT NULL;
