-- ============================================
-- 알라딘 검색 결과 캐시
-- ============================================
--
-- 문제:
--   유저 A가 "한강" 검색 → Aladin ItemSearch + ItemLookUp 6번 호출 (~2초)
--   유저 B가 "한강" 검색 → 또 6번 호출  ← 낭비 (Aladin 쿼터 소진)
--
-- 해결:
--   query_normalized 키로 최종 books 배열 캐시
--   TTL 7일 (신간 반영 위해 너무 길게는 안 함)
--
-- Supabase SQL Editor에서 실행하세요
-- ============================================

CREATE TABLE IF NOT EXISTS aladin_search_cache (
  query_normalized TEXT PRIMARY KEY,
  books JSONB NOT NULL,
  hit_count INT NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 만료 row 조회용
CREATE INDEX IF NOT EXISTS idx_aladin_search_cache_expires
  ON aladin_search_cache(expires_at);

ALTER TABLE aladin_search_cache ENABLE ROW LEVEL SECURITY;

-- 읽기: 모든 인증 유저
CREATE POLICY "Authenticated users can read aladin_search_cache"
  ON aladin_search_cache FOR SELECT TO authenticated USING (true);

-- 쓰기: 모든 인증 유저 (API route에서 upsert)
CREATE POLICY "Authenticated users can insert aladin_search_cache"
  ON aladin_search_cache FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update aladin_search_cache"
  ON aladin_search_cache FOR UPDATE TO authenticated USING (true);

-- 서비스 롤: 전체 관리
CREATE POLICY "Service role can manage aladin_search_cache"
  ON aladin_search_cache FOR ALL TO service_role USING (true);

-- hit_count 증가 함수 (book_contexts와 동일 패턴)
CREATE OR REPLACE FUNCTION increment_aladin_search_hits(p_query TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE aladin_search_cache
  SET hit_count = hit_count + 1,
      updated_at = NOW()
  WHERE query_normalized = p_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
