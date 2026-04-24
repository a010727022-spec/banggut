-- supabase/add-home-layout.sql
-- 홈 레이아웃 선택 (calendar/reading/community)
-- 기본값: 'calendar' — 캘린더 위젯 + 다가오는 일정 중심

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS home_layout TEXT DEFAULT 'calendar'
    CHECK (home_layout IN ('calendar', 'reading', 'community'));
