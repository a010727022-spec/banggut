import type { Book, Scrap } from "@/lib/types";
import type { HeroVariantData } from "./types";

/**
 * 책 본문을 몰라도 던질 수 있는 범용 질문 풀 (V1-A).
 * "내 경험"과 "읽는 중인 지금"에만 기대서 AI 환각 0%를 유지해요.
 */
export const OPEN_QUESTIONS: readonly string[] = [
  "지금까지 읽은 부분 중,\n한 번 더 읽고 싶은 장면 있어요?",
  "최근 한 구절에서\n마음이 잠시 멈춘 순간이 있었나요?",
  "이 책을 집어든 이유,\n아직 유효한가요?",
  "오늘 읽은 부분이\n어제랑 얼마나 달라졌나요?",
  "지금까지의 흐름을\n한 문장으로 요약해본다면요?",
  "이 책에서 한 명만\n친구에게 소개한다면 누구예요?",
  "지금 읽는 부분의 속도,\n너무 빨라요 아니면 너무 느려요?",
];

/**
 * 책 ID로 안정적인 질문을 고릅니다.
 * 같은 책은 항상 같은 질문이 뽑혀서 "이 책의 질문"처럼 느껴져요.
 */
function pickQuestionForBook(book: Book): string {
  const seed = Array.from(book.id).reduce(
    (acc, ch) => acc + ch.charCodeAt(0),
    0
  );
  return OPEN_QUESTIONS[seed % OPEN_QUESTIONS.length];
}

function daysBetween(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / (1000 * 60 * 60 * 24));
}

function daysUntil(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - now) / (1000 * 60 * 60 * 24));
}

/**
 * HERO 카드 변종 결정기 (Phase 1).
 *
 * 정책:
 * - **V3 오버라이드**: `book.group_books`가 있으면 무조건 V3 (모임 일정/진행 비교 중심)
 * - **기본 V1 체인**: B → A → C 순서로 첫 매치 리턴
 *   - V1-B: 이 책의 사용자 스크랩이 1개 이상이면 회상형
 *   - V1-A: 스크랩은 없지만 읽는 중 페이지가 있으면 범용 질문
 *   - V1-C: 그 외 (아직 진입 안 함) — 대화 진입 칩만
 *
 * 전제: AI는 책 본문을 모른다 → 모든 변종이 환각 0%.
 */
export function resolveHeroVariant(
  book: Book,
  scrapsForBook: readonly Scrap[] = []
): HeroVariantData {
  // 1) V3 오버라이드 — 모임이 연결된 책
  if (book.group_books) {
    return {
      kind: "v3-group",
      book,
      dday: daysUntil(book.group_books.end_date),
      groupName: book.group_books.reading_groups?.name ?? "북토크",
      roundNumber: book.group_books.round_number,
      endDate: book.group_books.end_date,
    };
  }

  // 2) V1-B — 이 책의 스크랩이 있으면 가장 최근 것으로 회상
  if (scrapsForBook.length > 0) {
    const scrap = scrapsForBook[0];
    const days = daysBetween(scrap.created_at) ?? 0;
    return {
      kind: "v1b-recall",
      book,
      scrap,
      daysSinceScrap: Math.max(0, days),
    };
  }

  // 3) V1-A — 읽는 중 진행이 있으면 범용 질문
  const hasProgress =
    (book.current_page ?? 0) > 0 || (book.progress_percent ?? 0) > 0;
  if (hasProgress) {
    return {
      kind: "v1a-open",
      book,
      question: pickQuestionForBook(book),
    };
  }

  // 4) V1-C — 아직 진입 전
  return { kind: "v1c-nudge", book };
}
