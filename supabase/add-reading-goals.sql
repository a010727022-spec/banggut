-- supabase/add-reading-goals.sql
-- 독서 목표 + 통계 위젯 선택

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS yearly_goal INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS daily_page_goal INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stats_widget TEXT DEFAULT 'today_goal'
    CHECK (stats_widget IN ('today_goal', 'yearly_ring'));
