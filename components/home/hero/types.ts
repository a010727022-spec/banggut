import type { Book, Scrap } from "@/lib/types";

/** HERO 카드 변종 종류 (Phase 1) */
export type HeroVariantKind =
  | "v3-group"
  | "v1b-recall"
  | "v1a-open"
  | "v1c-nudge";

/** V3 · 모임 대비형 — 책에 연결된 독서 모임이 있을 때 */
export interface V3GroupData {
  kind: "v3-group";
  book: Book;
  /** 마감까지 남은 일수. 음수면 지났고, null이면 end_date가 없어요 */
  dday: number | null;
  /** 예: "방긋 북토크". 이름이 없으면 "북토크" 기본값 */
  groupName: string;
  roundNumber: number;
  endDate: string | null;
}

/** V1-B · 회상형 — 이 책에 스크랩이 있을 때 (환각 0%) */
export interface V1BRecallData {
  kind: "v1b-recall";
  book: Book;
  scrap: Scrap;
  /** 스크랩 작성 후 며칠 경과했는지. 0이면 오늘, 1이면 어제 */
  daysSinceScrap: number;
}

/** V1-A · 범용 질문형 — 스크랩은 없지만 읽는 중 (책 내용 무관 질문) */
export interface V1AOpenData {
  kind: "v1a-open";
  book: Book;
  /** 책과 무관한 범용 질문 한 줄 (책 제목 해시로 안정 선택) */
  question: string;
}

/** V1-C · 넛지형 — 아직 진입조차 안 한 책 (최소 진입 칩만) */
export interface V1CNudgeData {
  kind: "v1c-nudge";
  book: Book;
}

export type HeroVariantData =
  | V3GroupData
  | V1BRecallData
  | V1AOpenData
  | V1CNudgeData;
