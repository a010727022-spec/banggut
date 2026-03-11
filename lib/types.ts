export interface User {
  id: string;
  nickname: string;
  emoji: string;
  created_at: string;
}

export interface TopicMap {
  confidence: "high" | "low";
  topics: string[];
}

export type ReadingStatus = "to_read" | "reading" | "finished" | "dropped";

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
  current_page: number | null;
  total_pages: number | null;
  rating: number | null;
  one_liner: string | null;
  cover_url: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context_data: any | null;
  context_fetched_at: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  scrap_count?: number;
  message_count?: number;
}

export interface Message {
  id: string;
  book_id: string;
  role: "user" | "assistant";
  content: string;
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

export interface Phase {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  turnRange: [number, number | null];
  guide: string;
}

export const PHASES: Phase[] = [
  {
    id: "explore", label: "탐색", icon: "🌱", description: "첫인상과 감정 나누기", color: "#2B4C3F", turnRange: [0, 7],
    guide: `[🌱 탐색 단계]
토론 초반, 첫인상을 나누는 단계입니다.
AI 행동: 감정적 질문, 기억에 남는 장면, 전체 느낌 위주.
- 유저가 기억에 남는 장면, 읽을 때의 느낌, 직관적 반응을 이야기하도록 이끌어주세요.
- 사실적 질문(1단계)은 워밍업으로만 최소한 사용. 해석적 질문(2단계)으로 자연스럽게 깊어지세요.
- 유저가 자연스럽게 분석이나 개인 경험을 꺼내면 막지 마세요. 그 흐름을 타되, 감정의 뿌리도 함께 탐색: "그 장면에서 처음 어떤 감정이 올라왔어요?"
전환 신호: 유저가 구체적 인물/장면을 깊이 언급하기 시작하면 → 심화로.`,
  },
  {
    id: "deepen", label: "심화", icon: "🔍", description: "주제와 의미 파고들기", color: "#3D6B5A", turnRange: [8, 15],
    guide: `[🔍 심화 단계]
특정 주제를 파고드는 단계입니다.
AI 행동: 해석적 질문(2단계)이 80%를 차지. 인물 동기, 작가 의도, 서사 구조, 상징 분석.
- 주제, 상징, 작가의 선택, 서사 구조, 인물의 동기를 함께 파고드세요.
- 유저가 개인 경험을 연결하면 받아주되, 텍스트로 다시 비춰보세요: "그 경험이 이 인물의 선택을 이해하는 데 도움이 됐을 수도 있겠네요. 그럼 이 인물은 왜 그런 결정을 했을까요?"
- 하나의 해석에 머무르지 말고 "다르게 읽을 수도 있지 않을까요?" 같은 질문으로 사고를 확장.
- 텍스트 근거 유도: "그 생각의 바탕이 된 장면이 있어요?"
전환 신호: 유저가 자기 삶/사회와 연결하기 시작하면 → 연결로.`,
  },
  {
    id: "connect", label: "연결", icon: "🔗", description: "내 삶과 세계에 연결하기", color: "#5A8A72", turnRange: [16, 23],
    guide: `[🔗 연결 단계]
책과 현실을 잇는 단계입니다.
AI 행동: 평가적 질문(3단계) 중심. 개인 경험 연결, 사회적 맥락, 다른 작품과의 비교.
- 유저의 삶, 지금 우리 사회, 다른 작품, 보편적 인간 경험으로 대화를 넓혀주세요.
- 이전 단계에서 발견한 해석을 실마리로: "아까 말씀하신 그 주제가 요즘 우리 사회에서는 어떻게 나타나고 있을까요?"
- "당신이라면 어떻게 했을 것 같아요?" "이 책을 읽고 나서 달라진 생각이 있어요?" 같은 질문.
- 유저가 텍스트 분석을 더 하고 싶어 하면 OK. 자연스럽게 확장.
전환 신호: 유저가 정리하고 싶어하는 신호를 보이면 → 서평으로.`,
  },
  {
    id: "review", label: "서평", icon: "✍️", description: "나만의 서평 완성하기", color: "#2B4C3F", turnRange: [24, null],
    guide: `[✍️ 서평 단계]
토론을 마무리하는 단계입니다.
AI 행동: 사고 변화 정리, 핵심 인사이트 요약, 서평 유도.
- 지금까지의 대화에서 유저가 발견한 것들을 함께 정리해주세요.
- 사고 변화 추적: "처음에는 OO라고 하셨는데, 지금은 XX로 바뀌셨네요. 뭐가 계기가 됐어요?"
- "이 책을 한 문장으로 말한다면?", "누군가에게 추천한다면 뭐라고 말할 것 같아요?" 같은 질문으로 생각을 결정화.
- 아직 하고 싶은 이야기가 있으면 서두르지 마세요.
- 대화가 무르익으면: "오늘 이야기한 걸 글로 정리해보면 어떨까요? 오른쪽 위 ✍️ 버튼을 눌러보세요."`,
  },
];

export const AVATARS = ["🦊","🐻","🐰","🦉","🐱","🐸","🦋","🌿","🍀","🌻","📖","✨","🎭","🎪"];

export function getPhaseByMessageCount(count: number): Phase {
  const userMessages = Math.floor(count / 2);
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (userMessages >= PHASES[i].turnRange[0]) return PHASES[i];
  }
  return PHASES[0];
}

export function getPhaseIndex(count: number): number {
  const userMessages = Math.floor(count / 2);
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (userMessages >= PHASES[i].turnRange[0]) return i;
  }
  return 0;
}
