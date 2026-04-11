-- ============================================
-- book_contexts: 글로벌 책 컨텍스트 캐시
-- ============================================
--
-- 문제:
--   유저 A가 "밝은 밤" 등록 → Gemini + Grok 검색 (₩50, 6초)
--   유저 B가 "밝은 밤" 등록 → 또 검색 (₩50, 6초)  ← 낭비!
--
-- 해결:
--   유저 A 검색 결과를 book_contexts에 저장
--   유저 B 이후 → DB에서 즉시 가져옴 (₩0, <100ms)
--
-- 흐름:
--   1) API가 title_normalized + author_normalized로 조회
--   2) 캐시 히트 → books 테이블에 복사, hit_count++
--   3) 캐시 미스 → fetch_status='fetching' 기록 (lock)
--      → Gemini/Grok 검색 → 결과 저장 (fetch_status='done')
--   4) 다른 유저가 동시에 요청 → fetch_status='fetching' 확인
--      → 중복 검색 안 함
--
-- Supabase SQL Editor에서 실행하세요
-- ============================================


-- ============================================
-- STEP 1: 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS book_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 캐시 키: 정규화된 제목+저자 (소문자, 공백통일, 구두점제거)
  -- "밝은 밤" = " 밝은 밤 " = "밝은밤" 모두 같은 키로 매칭
  title_normalized TEXT NOT NULL,
  author_normalized TEXT NOT NULL DEFAULT '',

  -- 원본 값 (UI 표시용, 첫 번째 등록한 유저의 입력값)
  title_original TEXT NOT NULL,
  author_original TEXT,

  -- Gemini + Grok 검색 결과 JSON
  -- 구조: { known, high, medium, plot_summary, themes, ... }
  context_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 현재 상태
  --   'fetching' : 누군가 검색 중 (다른 요청은 대기/스킵)
  --   'done'     : 검색 완료, 캐시 사용 가능
  --   'failed'   : 검색 실패 (다음 요청이 재시도 가능)
  fetch_status TEXT NOT NULL DEFAULT 'done'
    CHECK (fetch_status IN ('fetching', 'done', 'failed')),

  -- 캐시 히트 횟수 (첫 등록 = 1, 이후 재사용마다 +1)
  -- 인기 도서 파악, 캐시 효율 모니터링용
  hit_count INT NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- STEP 2: 인덱스
-- ============================================

-- 핵심: 정규화된 제목+저자 조합으로 유니크
-- API에서 .eq("title_normalized", x).eq("author_normalized", y) 로 조회
CREATE UNIQUE INDEX IF NOT EXISTS idx_book_contexts_title_author
  ON book_contexts(title_normalized, author_normalized);

-- title만으로 빠른 조회 (같은 제목, 다른 저자 검색 시)
CREATE INDEX IF NOT EXISTS idx_book_contexts_title
  ON book_contexts(title_normalized);


-- ============================================
-- STEP 3: RLS (Row Level Security)
-- ============================================
-- 이 테이블은 유저 소유가 아닌 공유 캐시이므로
-- 모든 인증 유저가 읽기/쓰기 가능 (API route에서 호출)

ALTER TABLE book_contexts ENABLE ROW LEVEL SECURITY;

-- 읽기: 모든 인증 유저
CREATE POLICY "Authenticated users can read book_contexts"
  ON book_contexts FOR SELECT
  TO authenticated
  USING (true);

-- 쓰기: 모든 인증 유저 (API route에서 upsert 호출)
CREATE POLICY "Authenticated users can insert book_contexts"
  ON book_contexts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update book_contexts"
  ON book_contexts FOR UPDATE
  TO authenticated
  USING (true);

-- 서비스 롤: 전체 관리 (관리자, 마이그레이션 등)
CREATE POLICY "Service role can manage book_contexts"
  ON book_contexts FOR ALL
  TO service_role
  USING (true);


-- ============================================
-- STEP 4: hit_count 증가 함수
-- ============================================
-- 캐시 히트 시 API에서 호출:
--   supabase.rpc("increment_book_context_hits", { p_title, p_author })
--
-- SECURITY DEFINER: 호출자 권한이 아닌 함수 소유자(postgres) 권한으로 실행
-- → RLS 우회하여 직접 UPDATE 가능

CREATE OR REPLACE FUNCTION increment_book_context_hits(
  p_title TEXT,
  p_author TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE book_contexts
  SET hit_count = hit_count + 1,
      updated_at = NOW()
  WHERE title_normalized = p_title
    AND author_normalized = p_author;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
