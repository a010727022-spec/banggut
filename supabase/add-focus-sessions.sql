-- ================================================================
-- focus_sessions · 집중 읽기 세션 로그 (뽀모도로 + 스톱워치)
-- Supabase SQL Editor에서 실행하세요 (멱등 — 재실행 안전)
-- ================================================================
--
-- 설계 메모 (v9 dream team consensus):
-- - 한 세션 = 한 번의 집중 읽기 블록
-- - 두 모드: 'pomodoro' (25분 고정) · 'stopwatch' (자유 카운트업)
-- - 완료된 세션 + 중단된 세션(30초 초과)만 저장
-- - pages_read_delta: 이 세션 동안 읽은 쪽수 (사용자가 직접 입력)
-- - duration_seconds: 실제 경과 시간 (일시정지 제외)
-- - 중단 세션: completed = false, pages_read_delta = 0
-- - 기존 reading_sessions 테이블과 구분: 그건 일별 pages_read 스냅샷,
--   이건 개별 집중 블록 로그
-- ================================================================

CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL DEFAULT 'pomodoro',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT NOT NULL DEFAULT 0,
  pages_read_delta INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- v8 → v9 마이그레이션: 기존 테이블에 mode 컬럼 추가 (멱등)
ALTER TABLE focus_sessions
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'pomodoro';

-- mode CHECK 제약 (중복 생성 방지)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'focus_sessions_mode_check'
  ) THEN
    ALTER TABLE focus_sessions
      ADD CONSTRAINT focus_sessions_mode_check
      CHECK (mode IN ('pomodoro', 'stopwatch'));
  END IF;
END$$;

-- 인덱스: 책별 최근 세션 조회 + 사용자별 통계용
CREATE INDEX IF NOT EXISTS focus_sessions_book_id_idx
  ON focus_sessions (book_id, started_at DESC);

CREATE INDEX IF NOT EXISTS focus_sessions_user_id_idx
  ON focus_sessions (user_id, started_at DESC);

-- RLS 활성화
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

-- 본인 세션만 조회
DROP POLICY IF EXISTS "Users can view own focus sessions" ON focus_sessions;
CREATE POLICY "Users can view own focus sessions"
  ON focus_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 세션만 생성
DROP POLICY IF EXISTS "Users can insert own focus sessions" ON focus_sessions;
CREATE POLICY "Users can insert own focus sessions"
  ON focus_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 세션만 업데이트 (pages_read_delta 나중에 수정 가능)
DROP POLICY IF EXISTS "Users can update own focus sessions" ON focus_sessions;
CREATE POLICY "Users can update own focus sessions"
  ON focus_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- 본인 세션만 삭제
DROP POLICY IF EXISTS "Users can delete own focus sessions" ON focus_sessions;
CREATE POLICY "Users can delete own focus sessions"
  ON focus_sessions FOR DELETE
  USING (auth.uid() = user_id);
