export interface User {
  id: string;
  nickname: string;
  emoji: string;
  created_at: string;
  preferred_genres?: string[];
  reading_frequency?: string;
  discussion_style?: string;
  onboarding_completed?: boolean;
}

export interface TopicMap {
  confidence: "high" | "low";
  topics: string[];
}

export type ReadingStatus = "want_to_read" | "to_read" | "reading" | "finished" | "dropped" | "abandoned";

export interface ReadingHistoryEntry {
  round: number;
  started_at: string | null;
  finished_at: string | null;
  reading_days: number | null;
  rating: number | null;
  one_line_review: string | null;
  scrap_ids: string[];
}

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  phase: number; // 0:탐색 1:심화 2:연결 3:서평
  has_review: boolean;
  topic_map: TopicMap | null;
  reading_status: ReadingStatus;
  started_at: string | null;
  finished_at: string | null;
  format: "paper" | "ebook";
  current_page: number | null;
  total_pages: number | null;
  progress_percent: number | null;
  ebook_location: string | null;
  rating: number | null;
  one_liner: string | null;
  cover_url: string | null;
  want_memo: string | null;
  recommended_by: string | null;
  abandoned_at: string | null;
  abandon_note: string | null;
  genre: string | null;
  ownership_type: "owned" | "borrowed" | "ebook" | null;
  borrowed_at: string | null;
  loan_days: number | null;
  due_date: string | null;
  borrowed_from: string | null;
  ebook_platform: string | null;
  reading_days: number | null;
  re_read_count: number | null;
  reading_history: ReadingHistoryEntry[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context_data: any | null;
  context_fetched_at: string | null;
  context_status: "fetching" | "done" | "failed" | null;
  created_at: string;
  updated_at: string;
  group_book_id: string | null;
  // joined fields
  scrap_count?: number;
  message_count?: number;
  group_books?: {
    id: string;
    group_id: string;
    weeks_data: { week: number; title: string; pageStart: number; pageEnd: number }[] | null;
    start_date: string | null;
    end_date: string | null;
    round_number: number;
    status: string;
    reading_groups: { id: string; name: string } | null;
  } | null;
}

export interface Message {
  id: string;
  book_id: string;
  role: "user" | "assistant";
  content: string;
  branch: string | null;
  created_at: string;
}

export interface Scrap {
  id: string;
  user_id: string;
  book_id: string | null;
  text: string;
  memo: string | null;
  book_title: string | null;
  book_author: string | null;
  page_number: number | null;
  source: "manual" | "camera";
  created_at: string;
}

export interface Underline {
  id: string;
  book_id: string;
  scrap_id: string | null;
  text: string;
  memo: string | null;
  chapter: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  book_id: string;
  user_id: string;
  mode: "essay" | "structured";
  content: ReviewContent;
  diagnosis: Diagnosis | null;
  is_public: boolean;
  created_at: string;
}

export interface EssayContent {
  body: string;
}

export interface StructuredContent {
  oneliner: string;
  keywords: string[];
  target: string;
  body: string;
}

export type ReviewContent = EssayContent | StructuredContent;

export interface DiagnosisDimension {
  id: string;
  label: string;
  icon: string;
  score: number;
  comment: string;
}

export interface Diagnosis {
  dimensions: DiagnosisDimension[];
  summary: string;
}

export interface Branch {
  id: string;
  label: string;
  icon: string;
}

export const BRANCHES: Branch[] = [
  { id: "emotion", label: "감정/첫인상", icon: "💬" },
  { id: "character", label: "인물 분석", icon: "👤" },
  { id: "conflict", label: "갈등/긴장", icon: "⚡" },
  { id: "connection", label: "내 삶과 연결", icon: "🔗" },
  { id: "perspective", label: "다른 시각", icon: "🎭" },
  { id: "author", label: "작가 의도", icon: "✍️" },
];

export const BRANCH_IDS = BRANCHES.map((b) => b.id);

/** AI 응답에서 [branch: xxx] 태그를 파싱하고 제거 */
export function parseBranchTag(content: string): { cleanContent: string; branch: string | null } {
  const match = content.match(/\[branch:\s*([\w]+)\]\s*$/);
  if (!match) return { cleanContent: content, branch: null };
  const branch = match[1];
  const cleanContent = content.replace(/\s*\[branch:\s*[\w]+\]\s*$/, "").trimEnd();
  return {
    cleanContent,
    branch: BRANCH_IDS.includes(branch) ? branch : null,
  };
}

export interface ReadingSession {
  id: string;
  book_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  pages_read: number | null;
  created_at: string;
}

export const AVATAR_IMAGES = [
  { id: "hemingway",      label: "헤밍웨이",       src: "/avatars/hemingway.png" },
  { id: "woolf",          label: "버지니아 울프",   src: "/avatars/woolf.png" },
  { id: "saint-exupery",  label: "생텍쥐페리",     src: "/avatars/saint-exupery.png" },
  { id: "shakespeare",    label: "셰익스피어",     src: "/avatars/shakespeare.png" },
  { id: "christie",       label: "아가사 크리스티", src: "/avatars/christie.png" },
  { id: "yi-sang",        label: "이상",           src: "/avatars/yi-sang.png" },
  { id: "kim-sowol",      label: "김소월",         src: "/avatars/kim-sowol.png" },
  { id: "kafka",          label: "카프카",         src: "/avatars/kafka.png" },
  { id: "nietzsche",      label: "니체",           src: "/avatars/nietzsche.png" },
] as const;

export const EMOJI_AVATARS = ["🦊","🐻","🐰","🦉","🐱","🐸","🦋","🌿","🍀","🌻","📖","✨","🎭","🎪"];

/** 아바타 ID → 이미지 경로. 이모지면 null 반환 */
export function getAvatarSrc(emoji: string | undefined | null): string | null {
  if (!emoji) return null;
  const found = AVATAR_IMAGES.find((a) => a.id === emoji);
  return found ? found.src : null;
}

/** 하위 호환용 */
export const AVATARS = [...AVATAR_IMAGES.map((a) => a.id), ...EMOJI_AVATARS];

/* ═══ 독서 모임 타입 ═══ */

export interface ReadingGroup {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  meeting_cycle: "weekly" | "biweekly" | "monthly" | "custom";
  meeting_day_of_week: number | null;
  invite_code: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profiles?: Pick<User, "id" | "nickname" | "emoji">;
}

export interface GroupBook {
  id: string;
  group_id: string;
  book_title: string;
  book_author: string | null;
  book_cover_url: string | null;
  book_isbn: string | null;
  round_number: number;
  start_date: string | null;
  end_date: string | null;
  status: "upcoming" | "reading" | "completed";
  num_weeks: number | null;
  total_pages: number | null;
  created_at: string;
}

export interface GroupSchedule {
  id: string;
  group_id: string;
  group_book_id: string | null;
  schedule_type: "start" | "checkpoint" | "meeting" | "custom";
  date: string;
  time: string | null;
  title: string | null;
  description: string | null;
  location: string | null;
  created_by: string | null;
  created_at: string;
}

export type MeetingCycle = ReadingGroup["meeting_cycle"];
