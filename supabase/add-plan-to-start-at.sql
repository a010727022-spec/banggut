-- supabase/add-plan-to-start-at.sql
-- 위시리스트 책에 "언제부터 읽을까요?" 계획일을 기록

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS plan_to_start_at DATE DEFAULT NULL;
