-- ① 읽고 싶은 책: want_to_read 상태 + 메모 + 추천인
-- ② 중단한 책: abandoned 상태 + abandoned_at + abandon_note
-- ③ 독서 세션 + 장르

-- books 테이블에 컬럼 추가
ALTER TABLE books ADD COLUMN IF NOT EXISTS want_memo TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS recommended_by TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS abandoned_at DATE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS abandon_note TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS genre TEXT;

-- 기존 dropped → abandoned 마이그레이션
UPDATE books SET reading_status = 'abandoned' WHERE reading_status = 'dropped';

-- reading_sessions 테이블 (독서 활동 기록)
CREATE TABLE IF NOT EXISTS reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  pages_read INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_id, date)
);

-- RLS
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reading sessions"
  ON reading_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reading sessions"
  ON reading_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reading sessions"
  ON reading_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reading sessions"
  ON reading_sessions FOR DELETE
  USING (auth.uid() = user_id);
