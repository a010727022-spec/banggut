-- supabase/add-taste-preferences-v2.sql
-- Convert discussion_style (single) to discussion_styles (array) for multi-select

-- 1. Add new array column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS discussion_styles TEXT[] DEFAULT '{}';

-- 2. Migrate existing single values to array (if any)
UPDATE profiles
  SET discussion_styles = ARRAY[discussion_style]
  WHERE discussion_style IS NOT NULL
    AND (discussion_styles IS NULL OR array_length(discussion_styles, 1) IS NULL);

-- 3. (Optional) Drop old column after confirming migration
--    Uncomment when ready:
-- ALTER TABLE profiles DROP COLUMN IF EXISTS discussion_style;
