-- messages 테이블에 branch 컬럼 추가
-- 토론 갈래 트래커: AI 응답마다 어떤 갈래인지 태깅
-- 값: emotion, character, conflict, connection, perspective, author
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE messages ADD COLUMN IF NOT EXISTS branch TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_branch ON messages(branch) WHERE branch IS NOT NULL;
