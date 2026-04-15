-- ============================================
-- topic_map 글로벌 캐시 (book_contexts 테이블 재활용)
-- ============================================
--
-- 문제:
--   유저 A가 "해방자들" 등록 → topic-map API → Gemini 호출 (₩, 2~3초)
--   유저 B가 "해방자들" 등록 → 또 Gemini 호출  ← 낭비
--
-- 해결:
--   book_contexts 테이블에 topic_map JSONB 컬럼 추가
--   같은 title_normalized + author_normalized 조합이면 즉시 반환
--
-- Supabase SQL Editor에서 실행하세요
-- ============================================

ALTER TABLE book_contexts
  ADD COLUMN IF NOT EXISTS topic_map JSONB;

ALTER TABLE book_contexts
  ADD COLUMN IF NOT EXISTS topic_map_fetched_at TIMESTAMPTZ;
