-- ============================================
-- 보안 점검 2번: RLS 누락 8개 테이블 일괄 적용
-- ============================================
--
-- 대상 8개 테이블 (모두 RLS 꺼져있던 상태):
--   1) book_votes          - 그룹 도서 투표 라운드
--   2) vote_candidates     - 투표 후보 도서
--   3) vote_ballots        - 개인 투표
--   4) meeting_records     - 모임 기록/회의록
--   5) meeting_impressions - 모임 소감
--   6) presentations       - 발표 자료
--   7) presenter_order     - 발표 순서
--   8) schedule_attendees  - 일정 참석 여부
--
-- 정책 방향:
--   - 읽기: 같은 그룹 멤버만 (그룹 내부 데이터)
--   - 쓰기: 그룹 멤버 (본인 행 한정 or admin)
--   - 기존 add-groups-rls.sql 패턴과 일관성 유지
--
-- idempotent: 여러 번 실행해도 안전 (DROP IF EXISTS -> CREATE)
-- ============================================


-- ============================================
-- 1) book_votes  (group_id 직접 보유)
-- ============================================
ALTER TABLE book_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view votes" ON book_votes;
DROP POLICY IF EXISTS "Group members can insert votes" ON book_votes;
DROP POLICY IF EXISTS "Group admins can update votes" ON book_votes;
DROP POLICY IF EXISTS "Group admins can delete votes" ON book_votes;

-- 읽기: 그룹 멤버
CREATE POLICY "Group members can view votes"
  ON book_votes FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- 생성: 그룹 멤버
CREATE POLICY "Group members can insert votes"
  ON book_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- 수정: admin (투표 상태 변경 등)
CREATE POLICY "Group admins can update votes"
  ON book_votes FOR UPDATE
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 삭제: admin
CREATE POLICY "Group admins can delete votes"
  ON book_votes FOR DELETE
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- ============================================
-- 2) vote_candidates  (vote_id -> book_votes.group_id)
-- ============================================
ALTER TABLE vote_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view candidates" ON vote_candidates;
DROP POLICY IF EXISTS "Group members can insert candidates" ON vote_candidates;
DROP POLICY IF EXISTS "Nominators can delete own candidates" ON vote_candidates;

-- 읽기: 해당 투표가 속한 그룹의 멤버
CREATE POLICY "Group members can view candidates"
  ON vote_candidates FOR SELECT
  TO authenticated
  USING (
    vote_id IN (
      SELECT id FROM book_votes
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

-- 추천: 그룹 멤버 + 본인이 추천자
CREATE POLICY "Group members can insert candidates"
  ON vote_candidates FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = nominated_by
    AND vote_id IN (
      SELECT id FROM book_votes
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

-- 삭제: 본인이 추천한 후보만
CREATE POLICY "Nominators can delete own candidates"
  ON vote_candidates FOR DELETE
  TO authenticated
  USING (auth.uid() = nominated_by);


-- ============================================
-- 3) vote_ballots  (candidate_id -> vote_candidates -> book_votes)
-- ============================================
ALTER TABLE vote_ballots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view ballots" ON vote_ballots;
DROP POLICY IF EXISTS "Users can cast own ballot" ON vote_ballots;
DROP POLICY IF EXISTS "Users can delete own ballot" ON vote_ballots;

-- 읽기: 해당 투표가 속한 그룹의 멤버
CREATE POLICY "Group members can view ballots"
  ON vote_ballots FOR SELECT
  TO authenticated
  USING (
    candidate_id IN (
      SELECT id FROM vote_candidates
      WHERE vote_id IN (
        SELECT id FROM book_votes
        WHERE group_id IN (
          SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- 투표: 본인 행만
CREATE POLICY "Users can cast own ballot"
  ON vote_ballots FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND candidate_id IN (
      SELECT id FROM vote_candidates
      WHERE vote_id IN (
        SELECT id FROM book_votes
        WHERE group_id IN (
          SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- 투표 취소: 본인 행만
CREATE POLICY "Users can delete own ballot"
  ON vote_ballots FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================
-- 4) meeting_records  (schedule_id -> group_schedules.group_id)
-- ============================================
ALTER TABLE meeting_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view meeting records" ON meeting_records;
DROP POLICY IF EXISTS "Group members can insert meeting records" ON meeting_records;
DROP POLICY IF EXISTS "Group members can update meeting records" ON meeting_records;
DROP POLICY IF EXISTS "Group admins can delete meeting records" ON meeting_records;

-- 읽기: 그룹 멤버
CREATE POLICY "Group members can view meeting records"
  ON meeting_records FOR SELECT
  TO authenticated
  USING (
    schedule_id IN (
      SELECT id FROM group_schedules
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

-- 생성: 그룹 멤버
CREATE POLICY "Group members can insert meeting records"
  ON meeting_records FOR INSERT
  TO authenticated
  WITH CHECK (
    schedule_id IN (
      SELECT id FROM group_schedules
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

-- 수정: 그룹 멤버 (회의록 보완)
CREATE POLICY "Group members can update meeting records"
  ON meeting_records FOR UPDATE
  TO authenticated
  USING (
    schedule_id IN (
      SELECT id FROM group_schedules
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

-- 삭제: admin
CREATE POLICY "Group admins can delete meeting records"
  ON meeting_records FOR DELETE
  TO authenticated
  USING (
    schedule_id IN (
      SELECT id FROM group_schedules
      WHERE group_id IN (
        SELECT group_id FROM group_members
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );


-- ============================================
-- 5) meeting_impressions  (meeting_record_id -> meeting_records -> group_schedules)
-- ============================================
ALTER TABLE meeting_impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view impressions" ON meeting_impressions;
DROP POLICY IF EXISTS "Users can insert own impressions" ON meeting_impressions;
DROP POLICY IF EXISTS "Users can update own impressions" ON meeting_impressions;
DROP POLICY IF EXISTS "Users can delete own impressions" ON meeting_impressions;

-- 읽기: 그룹 멤버
CREATE POLICY "Group members can view impressions"
  ON meeting_impressions FOR SELECT
  TO authenticated
  USING (
    meeting_record_id IN (
      SELECT id FROM meeting_records
      WHERE schedule_id IN (
        SELECT id FROM group_schedules
        WHERE group_id IN (
          SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- 작성: 본인 소감만
CREATE POLICY "Users can insert own impressions"
  ON meeting_impressions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND meeting_record_id IN (
      SELECT id FROM meeting_records
      WHERE schedule_id IN (
        SELECT id FROM group_schedules
        WHERE group_id IN (
          SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- 수정: 본인 소감만
CREATE POLICY "Users can update own impressions"
  ON meeting_impressions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 삭제: 본인 소감만
CREATE POLICY "Users can delete own impressions"
  ON meeting_impressions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================
-- 6) presentations  (group_book_id -> group_books.group_id)
-- ============================================
ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view presentations" ON presentations;
DROP POLICY IF EXISTS "Presenters can insert own presentations" ON presentations;
DROP POLICY IF EXISTS "Presenters can update own presentations" ON presentations;
DROP POLICY IF EXISTS "Presenters can delete own presentations" ON presentations;

-- 읽기: 그룹 멤버
CREATE POLICY "Group members can view presentations"
  ON presentations FOR SELECT
  TO authenticated
  USING (
    group_book_id IN (
      SELECT id FROM group_books
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

-- 생성: 본인 발표만
CREATE POLICY "Presenters can insert own presentations"
  ON presentations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = presenter_id
    AND group_book_id IN (
      SELECT id FROM group_books
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

-- 수정: 본인 발표만
CREATE POLICY "Presenters can update own presentations"
  ON presentations FOR UPDATE
  TO authenticated
  USING (auth.uid() = presenter_id);

-- 삭제: 본인 발표만
CREATE POLICY "Presenters can delete own presentations"
  ON presentations FOR DELETE
  TO authenticated
  USING (auth.uid() = presenter_id);


-- ============================================
-- 7) presenter_order  (group_id 직접 보유)
-- ============================================
ALTER TABLE presenter_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view presenter order" ON presenter_order;
DROP POLICY IF EXISTS "Group admins can insert presenter order" ON presenter_order;
DROP POLICY IF EXISTS "Group admins can update presenter order" ON presenter_order;
DROP POLICY IF EXISTS "Group admins can delete presenter order" ON presenter_order;

-- 읽기: 그룹 멤버
CREATE POLICY "Group members can view presenter order"
  ON presenter_order FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- 생성/수정/삭제: admin만 (발표 순서 관리)
CREATE POLICY "Group admins can insert presenter order"
  ON presenter_order FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Group admins can update presenter order"
  ON presenter_order FOR UPDATE
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Group admins can delete presenter order"
  ON presenter_order FOR DELETE
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- ============================================
-- 8) schedule_attendees  (schedule_id -> group_schedules.group_id)
-- ============================================
ALTER TABLE schedule_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view attendees" ON schedule_attendees;
DROP POLICY IF EXISTS "Users can insert own attendance" ON schedule_attendees;
DROP POLICY IF EXISTS "Users can update own attendance" ON schedule_attendees;
DROP POLICY IF EXISTS "Users can delete own attendance" ON schedule_attendees;

-- 읽기: 그룹 멤버
CREATE POLICY "Group members can view attendees"
  ON schedule_attendees FOR SELECT
  TO authenticated
  USING (
    schedule_id IN (
      SELECT id FROM group_schedules
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

-- 참석 등록: 본인만
CREATE POLICY "Users can insert own attendance"
  ON schedule_attendees FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND schedule_id IN (
      SELECT id FROM group_schedules
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

-- 참석 상태 변경: 본인만
CREATE POLICY "Users can update own attendance"
  ON schedule_attendees FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 참석 취소: 본인만
CREATE POLICY "Users can delete own attendance"
  ON schedule_attendees FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================
-- 검증 쿼리 (실행 후 확인용 - 별도로 돌려보세요)
-- ============================================
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname='public'
--   AND tablename IN ('book_votes','vote_candidates','vote_ballots',
--                     'meeting_records','meeting_impressions','presentations',
--                     'presenter_order','schedule_attendees');
--
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname='public'
--   AND tablename IN ('book_votes','vote_candidates','vote_ballots',
--                     'meeting_records','meeting_impressions','presentations',
--                     'presenter_order','schedule_attendees')
-- ORDER BY tablename, policyname;
