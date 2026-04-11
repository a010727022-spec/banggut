-- ============================================
-- 보안 점검 1번: 그룹/라이브/스트릭 테이블 RLS 일괄 적용
-- ============================================
--
-- 대상 6개 테이블 (모두 RLS 꺼져있던 상태):
--   1) reading_groups   - 독서 모임
--   2) group_members    - 모임 멤버십
--   3) group_books      - 모임에서 읽는 책
--   4) group_schedules  - 모임 일정
--   5) reading_live     - 실시간 독서 상태
--   6) reading_streaks  - 독서 연속 기록
--
-- 정책 방향:
--   - group_members SELECT는 "느슨" (인증 유저면 누구나)
--     이유: invite 페이지에서 비멤버도 멤버 수 표시 필요
--   - reading_groups SELECT는 "공개" (anon 포함)
--     이유: 비로그인 상태에서 초대 링크로 모임 정보 보고 가입 결정
--   - 쓰기는 모두 본인/admin 한정
--
-- idempotent: 여러 번 실행해도 안전 (DROP IF EXISTS → CREATE)
-- ============================================


-- ============================================
-- 1) reading_groups
-- ============================================
ALTER TABLE reading_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view groups" ON reading_groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON reading_groups;
DROP POLICY IF EXISTS "Group admins can update" ON reading_groups;
DROP POLICY IF EXISTS "Group admins can delete" ON reading_groups;

-- 읽기: 누구나 (초대 링크 비로그인 접근 위해 anon 포함)
CREATE POLICY "Anyone can view groups"
  ON reading_groups FOR SELECT
  USING (true);

-- 생성: 인증 유저
CREATE POLICY "Authenticated users can create groups"
  ON reading_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- 수정: admin 멤버만
CREATE POLICY "Group admins can update"
  ON reading_groups FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 삭제: admin 멤버만
CREATE POLICY "Group admins can delete"
  ON reading_groups FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- ============================================
-- 2) group_members
-- ============================================
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view members" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
DROP POLICY IF EXISTS "Admins can update members" ON group_members;

-- 읽기: 인증 유저면 누구나 (느슨, invite 페이지 멤버수 표시)
CREATE POLICY "Authenticated users can view members"
  ON group_members FOR SELECT
  TO authenticated
  USING (true);

-- 가입: 본인만 자기 행 INSERT
CREATE POLICY "Users can join groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 탈퇴: 본인만 자기 행 DELETE
CREATE POLICY "Users can leave groups"
  ON group_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 멤버 role 변경: admin만
CREATE POLICY "Admins can update members"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- ============================================
-- 3) group_books
-- ============================================
ALTER TABLE group_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view group books" ON group_books;
DROP POLICY IF EXISTS "Group members can insert books" ON group_books;
DROP POLICY IF EXISTS "Group members can update books" ON group_books;
DROP POLICY IF EXISTS "Group members can delete books" ON group_books;

-- 읽기: 누구나 (초대 페이지 "현재 읽는 책" 표시 + 비로그인 접근)
CREATE POLICY "Anyone can view group books"
  ON group_books FOR SELECT
  USING (true);

-- 추가: 그룹 멤버
CREATE POLICY "Group members can insert books"
  ON group_books FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- 수정: 그룹 멤버
CREATE POLICY "Group members can update books"
  ON group_books FOR UPDATE
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- 삭제: 그룹 admin
CREATE POLICY "Group members can delete books"
  ON group_books FOR DELETE
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- ============================================
-- 4) group_schedules
-- ============================================
ALTER TABLE group_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view schedules" ON group_schedules;
DROP POLICY IF EXISTS "Group members can insert schedules" ON group_schedules;
DROP POLICY IF EXISTS "Group members can update schedules" ON group_schedules;
DROP POLICY IF EXISTS "Group members can delete schedules" ON group_schedules;

-- 읽기: 그룹 멤버만 (일정/장소 정보는 멤버 한정)
CREATE POLICY "Group members can view schedules"
  ON group_schedules FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- 추가: 그룹 멤버
CREATE POLICY "Group members can insert schedules"
  ON group_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- 수정: 그룹 멤버 (생성자 또는 admin이 더 안전하지만 컬럼 확인 후 강화 가능)
CREATE POLICY "Group members can update schedules"
  ON group_schedules FOR UPDATE
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- 삭제: admin
CREATE POLICY "Group members can delete schedules"
  ON group_schedules FOR DELETE
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- ============================================
-- 5) reading_live
-- ============================================
ALTER TABLE reading_live ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view live" ON reading_live;
DROP POLICY IF EXISTS "Users can upsert own live" ON reading_live;
DROP POLICY IF EXISTS "Users can update own live" ON reading_live;
DROP POLICY IF EXISTS "Users can delete own live" ON reading_live;

-- 읽기: 같은 그룹 멤버만 + 본인
CREATE POLICY "Group members can view live"
  ON reading_live FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- 시작: 본인 행만
CREATE POLICY "Users can upsert own live"
  ON reading_live FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 진행률 업데이트: 본인 행만
CREATE POLICY "Users can update own live"
  ON reading_live FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 종료: 본인 행만
CREATE POLICY "Users can delete own live"
  ON reading_live FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================
-- 6) reading_streaks
-- ============================================
ALTER TABLE reading_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own streaks" ON reading_streaks;
DROP POLICY IF EXISTS "Users can insert own streaks" ON reading_streaks;
DROP POLICY IF EXISTS "Users can update own streaks" ON reading_streaks;
DROP POLICY IF EXISTS "Users can delete own streaks" ON reading_streaks;

-- 읽기: 본인만 (개인 활동 히스토리)
CREATE POLICY "Users can view own streaks"
  ON reading_streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks"
  ON reading_streaks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON reading_streaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own streaks"
  ON reading_streaks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================
-- 검증 쿼리 (실행 후 확인용 - 별도로 돌려보세요)
-- ============================================
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname='public'
--   AND tablename IN ('reading_groups','group_members','group_books',
--                     'group_schedules','reading_live','reading_streaks');
--
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname='public'
--   AND tablename IN ('reading_groups','group_members','group_books',
--                     'group_schedules','reading_live','reading_streaks')
-- ORDER BY tablename, policyname;
