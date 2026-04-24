"use client";

import { useMemo } from "react";
import type { Book, Scrap } from "@/lib/types";
import { resolveHeroVariant } from "./hero/resolver";
import V1BRecall from "./hero/V1BRecall";
import V1AOpen from "./hero/V1AOpen";
import V1CNudge from "./hero/V1CNudge";
import V3Group from "./hero/V3Group";

/**
 * ContinueHeroCard — 이어 읽기 HERO 디스패처.
 *
 * 책과 이 책의 스크랩을 받아서 {@link resolveHeroVariant}로 변종을 고르고,
 * 해당 variant 컴포넌트로 렌더링을 위임합니다.
 *
 * 정책 (Phase 1):
 * - **V3 오버라이드**: `book.group_books`가 있으면 V3 (모임 대비형)
 * - **기본 V1 체인**: B → A → C
 *   - V1-B: 이 책 스크랩 ≥ 1개 → 회상형
 *   - V1-A: 읽는 중 진행 ≥ 1쪽 → 범용 질문형
 *   - V1-C: 그 외 → 대화 진입 칩
 *
 * 전제: AI는 책 본문을 모른다 → 모든 변종이 환각 0%.
 *
 * @param book           이어 읽기 대상 책 (가장 최근 업데이트된 '읽는 중' 책)
 * @param lastScrap      호환용 — `scrapsForBook`이 없을 때 이 스크랩이 book_id 일치하면 사용
 * @param scrapsForBook  이 책에 대한 스크랩 목록 (최신순). 있으면 `lastScrap`보다 우선
 */
export default function ContinueHeroCard({
  book,
  lastScrap,
  scrapsForBook,
}: {
  book: Book;
  lastScrap?: Scrap | null;
  scrapsForBook?: Scrap[];
}) {
  // scrapsForBook이 없으면 lastScrap을 fallback으로 사용 (book_id 일치할 때만)
  const effectiveScraps = useMemo<Scrap[]>(() => {
    if (scrapsForBook && scrapsForBook.length > 0) return scrapsForBook;
    if (lastScrap && lastScrap.book_id === book.id) return [lastScrap];
    return [];
  }, [scrapsForBook, lastScrap, book.id]);

  const variant = useMemo(
    () => resolveHeroVariant(book, effectiveScraps),
    [book, effectiveScraps]
  );

  switch (variant.kind) {
    case "v3-group":
      return <V3Group data={variant} />;
    case "v1b-recall":
      return <V1BRecall data={variant} />;
    case "v1a-open":
      return <V1AOpen data={variant} />;
    case "v1c-nudge":
      return <V1CNudge data={variant} />;
  }
}
