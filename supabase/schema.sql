-- ============================================
-- 방긋 (Banggut) Database Schema
-- Supabase SQL Editor에서 아래 3단계를 순서대로 실행하세요
-- ============================================

-- ============================================
-- STEP 1: 테이블 생성 (이것부터 복사해서 실행)
-- ============================================

-- Profiles (auth.users와 연동)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  emoji TEXT DEFAULT '🦊',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Books
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  phase INT DEFAULT 0,
  has_review BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages (토론 내역)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('user','assistant')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraps (글귀 스크랩)
CREATE TABLE IF NOT EXISTS scraps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  memo TEXT,
  book_title TEXT,
  book_author TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual','camera')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Underlines (책별 밑줄)
CREATE TABLE IF NOT EXISTS underlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  scrap_id UUID REFERENCES scraps(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  memo TEXT,
  chapter TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews (서평)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mode TEXT CHECK (mode IN ('essay','structured')) NOT NULL,
  content JSONB NOT NULL,
  diagnosis JSONB,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 2: RLS 활성화 + 정책 (STEP 1 성공 후 실행)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraps ENABLE ROW LEVEL SECURITY;
ALTER TABLE underlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Books
CREATE POLICY "Users can CRUD own books" ON books FOR ALL USING (auth.uid() = user_id);

-- Messages
CREATE POLICY "Users can CRUD own messages" ON messages FOR ALL
  USING (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()));

-- Scraps
CREATE POLICY "Users can CRUD own scraps" ON scraps FOR ALL USING (auth.uid() = user_id);

-- Underlines
CREATE POLICY "Users can CRUD own underlines" ON underlines FOR ALL
  USING (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()));

-- Reviews
CREATE POLICY "Users can CRUD own reviews" ON reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read public reviews" ON reviews FOR SELECT USING (is_public = true);

-- ============================================
-- STEP 3: 인덱스 (STEP 2 성공 후 실행)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_book_id ON messages(book_id);
CREATE INDEX IF NOT EXISTS idx_scraps_user_id ON scraps(user_id);
CREATE INDEX IF NOT EXISTS idx_underlines_book_id ON underlines(book_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_book_id ON reviews(book_id);
