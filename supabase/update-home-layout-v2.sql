-- supabase/update-home-layout-v2.sql
-- 홈 레이아웃 2-테마 체계로 전환 (hero / calendar)
-- 기존 3-옵션 (calendar/reading/community) → 새 2-옵션 (hero/calendar)
-- 마이그레이션 규칙:
--   calendar  → calendar  (유지)
--   reading   → hero      (이어 읽기 HERO)
--   community → calendar  (친구 피드는 calendar 테마에 포함)
-- DEFAULT: 'hero' (목업에서 테마 A가 기본)

-- 1) 기존 CHECK 제약 제거 (UPDATE 전에 해제해야 함)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_home_layout_check;

-- 2) 기존 값 마이그레이션
UPDATE profiles SET home_layout = 'hero'     WHERE home_layout = 'reading';
UPDATE profiles SET home_layout = 'calendar' WHERE home_layout = 'community';

-- 혹시 NULL이거나 유효하지 않은 값이 남아있다면 기본값으로 통일
UPDATE profiles
  SET home_layout = 'hero'
  WHERE home_layout IS NULL
     OR home_layout NOT IN ('hero', 'calendar');

-- 3) 새 DEFAULT 값
ALTER TABLE profiles
  ALTER COLUMN home_layout SET DEFAULT 'hero';

-- 4) 새 CHECK 제약 추가
ALTER TABLE profiles
  ADD CONSTRAINT profiles_home_layout_check
    CHECK (home_layout IN ('hero', 'calendar'));
