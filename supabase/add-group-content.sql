-- ============================================
-- 모임 콘텐츠: 스크랩 공유 RLS 확장 + 토론 테이블
-- ============================================
--
-- 1) underlines/scraps RLS를 모임 멤버까지 확장
--    같은 group_book_id를 공유하는 책의 밑줄/스크랩은 모임 멤버 모두 SELECT 가능
-- 2) group_discussions: 모임 토론 질문 카드
-- 3) group_discussion_replies: 답변
--
-- idempotent: DROP IF EXISTS 후 CREATE
-- ============================================


-- ============================================
-- 1) underlines RLS 확장
-- ============================================
DROP POLICY IF EXISTS "Group members can view group underlines" ON underlines;

CREATE POLICY "Group members can view group underlines"
  ON underlines FOR SELECT
  TO authenticated
  USING (
    book_id IN (
      SELECT b.id FROM books b
      WHERE b.group_book_id IS NOT NULL
        AND b.group_book_id IN (
          SELECT gb.id FROM group_books gb
          WHERE gb.group_id IN (
            SELECT gm.group_id FROM group_members gm
            WHERE gm.user_id = auth.uid()
          )
        )
    )
  );


-- ============================================
-- 2) scraps RLS 확장
-- ============================================
DROP POLICY IF EXISTS "Group members can view group scraps" ON scraps;

CREATE POLICY "Group members can view group scraps"
  ON scraps FOR SELECT
  TO authenticated
  USING (
    book_id IN (
      SELECT b.id FROM books b
      WHERE b.group_book_id IS NOT NULL
        AND b.group_book_id IN (
          SELECT gb.id FROM group_books gb
          WHERE gb.group_id IN (
            SELECT gm.group_id FROM group_members gm
            WHERE gm.user_id = auth.uid()
          )
        )
    )
  );


-- ============================================
-- 3) group_discussions 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS group_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES reading_groups(id) ON DELETE CASCADE,
  group_book_id UUID REFERENCES group_books(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_discussions_group ON group_discussions(group_id, created_at DESC);

ALTER TABLE group_discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view discussions" ON group_discussions;
DROP POLICY IF EXISTS "Group members can create discussions" ON group_discussions;
DROP POLICY IF EXISTS "Authors can delete own discussions" ON group_discussions;

CREATE POLICY "Group members can view discussions"
  ON group_discussions FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create discussions"
  ON group_discussions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authors can delete own discussions"
  ON group_discussions FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);


-- ============================================
-- 4) group_discussion_replies 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS group_discussion_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES group_discussions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_discussion_replies_discussion ON group_discussion_replies(discussion_id, created_at);

ALTER TABLE group_discussion_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view replies" ON group_discussion_replies;
DROP POLICY IF EXISTS "Group members can create replies" ON group_discussion_replies;
DROP POLICY IF EXISTS "Authors can delete own replies" ON group_discussion_replies;

CREATE POLICY "Group members can view replies"
  ON group_discussion_replies FOR SELECT
  TO authenticated
  USING (
    discussion_id IN (
      SELECT id FROM group_discussions
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Group members can create replies"
  ON group_discussion_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND discussion_id IN (
      SELECT id FROM group_discussions
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authors can delete own replies"
  ON group_discussion_replies FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);
