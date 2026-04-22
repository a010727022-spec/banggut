"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useLibraryViewStore } from "@/stores/useLibraryViewStore";
import { getBooks, getScraps } from "@/lib/supabase/queries";
import type { Book, Scrap } from "@/lib/types";

import { LibraryHeader } from "@/components/library/LibraryHeader";
import { LibraryViewA } from "@/components/library/view-a";
import { LibraryViewB } from "@/components/library/view-b";
import { LibraryViewC } from "@/components/library/view-c";

/* 뷰 B의 '이달의 한 문장' 섹션을 위해 최신 스크랩 1개만 가져와요.
   이어 읽기 맥락은 홈의 <ContinueHeroCard> 로 이관됐어요. */

/**
 * /library — 가상 서재
 *
 * `public/mockup-library-v1.html` 기반 세 가지 뷰를 상단 토글로 전환해요.
 *   A · 책꽂이 은유   — 책등 가로 스크롤 + 쉘프 나무 바
 *   B · 큐레이터 보드 — 표지 2-col 그리드 + 이달의 한 문장
 *   C · 4 스택       — 2×2 무더기 카운트 + 주간 하이라이트
 */
export default function LibraryPage() {
  const user = useAuthStore((s) => s.user);
  const { books, setBooks } = useLibraryStore();
  const view = useLibraryViewStore((s) => s.view);
  const exhibit = useLibraryViewStore((s) => s.exhibit);
  const setExhibit = useLibraryViewStore((s) => s.setExhibit);
  const [scraps, setScraps] = useState<Scrap[]>([]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    // 뷰 B의 '이달의 한 문장' 용도로 최신 1개만 가져와요.
    Promise.all([getBooks(supabase, user.id), getScraps(supabase, user.id, 1)])
      .then(([bookData, scrapData]) => {
        setBooks(bookData);
        setScraps(scrapData);
      })
      .catch(() => {
        /* 조용히 실패 — 빈 상태 UI */
      });
  }, [user, setBooks]);

  const {
    reading,
    finishedThisYear,
    allFinishedCount,
    allFinishedBooks,
    wishBooks,
    borrowedBooks,
  } = useMemo(() => buildBuckets(books), [books]);

  const curatedShelves = useMemo(
    () => buildCuratedShelves(finishedThisYear, books),
    [finishedThisYear, books]
  );

  const latestScrap = scraps[0] ?? null;
  const nickname = user?.nickname ?? "독서가";
  const totalBooks = books.length;

  return (
    <div
      style={{
        padding: "0 20px 100px",
        minHeight: "calc(100vh - var(--nav-height))",
        background: "var(--bg)",
        transition: "background var(--duration-default) var(--easing-default)",
      }}
    >
      <LibraryHeader
        nickname={nickname}
        totalBooks={totalBooks}
        exhibit={exhibit}
        onExhibitToggle={() => setExhibit(!exhibit)}
        view={view}
      />

      {view === "A" && (
        <LibraryViewA
          reading={reading}
          finishedThisYear={finishedThisYear}
          allFinishedCount={allFinishedCount}
          allFinishedBooks={allFinishedBooks}
          wishBooks={wishBooks}
          borrowedBooks={borrowedBooks}
          curatedShelves={curatedShelves}
        />
      )}
      {view === "B" && (
        <LibraryViewB
          reading={reading}
          curatedShelves={curatedShelves}
          latestScrap={latestScrap}
        />
      )}
      {view === "C" && (
        <LibraryViewC
          reading={reading}
          finishedThisYear={finishedThisYear}
          wishBooks={wishBooks}
          borrowedBooks={borrowedBooks}
        />
      )}
    </div>
  );
}

/* ─── 버킷 분류 ─────────────────────────────── */
function buildBuckets(books: Book[]) {
  const thisYear = new Date().getFullYear();
  const reading: Book[] = [];
  const finishedAll: Book[] = [];
  const finishedThisYear: Book[] = [];
  const wishBooks: Book[] = [];
  const borrowedBooks: Book[] = [];

  for (const b of books) {
    if (b.reading_status === "reading") reading.push(b);
    else if (b.reading_status === "finished") {
      finishedAll.push(b);
      const fin = b.finished_at ?? b.updated_at;
      if (fin && new Date(fin).getFullYear() === thisYear) {
        finishedThisYear.push(b);
      }
    } else if (
      b.reading_status === "want_to_read" ||
      b.reading_status === "to_read"
    ) {
      wishBooks.push(b);
    }
    if (b.ownership_type === "borrowed") borrowedBooks.push(b);
  }

  // 읽는 중: 모임 책 우선
  reading.sort(
    (a, b) => (b.group_books ? 1 : 0) - (a.group_books ? 1 : 0)
  );
  // 올해 완독: 최근 완독 순
  finishedThisYear.sort(
    (a, b) =>
      new Date(b.finished_at ?? b.updated_at).getTime() -
      new Date(a.finished_at ?? a.updated_at).getTime()
  );
  // 위시: 계획된 시작일이 가까운 순
  wishBooks.sort((a, b) => {
    const da = a.plan_to_start_at
      ? new Date(a.plan_to_start_at).getTime()
      : Infinity;
    const db = b.plan_to_start_at
      ? new Date(b.plan_to_start_at).getTime()
      : Infinity;
    return da - db;
  });

  return {
    reading,
    finishedThisYear,
    allFinishedCount: finishedAll.length,
    allFinishedBooks: finishedAll,
    wishBooks,
    borrowedBooks,
  };
}

/* ─── 큐레이션 쉘프 자동 그룹 ───────────────────
   사용자 쉘프 스키마가 생기기 전까지는 장르로 auto-group.
   각 장르에 2권 이상이면 하나의 쉘프로 승격.
*/
function buildCuratedShelves(
  finishedThisYear: Book[],
  allBooks: Book[]
): { name: string; reason: string; books: Book[] }[] {
  const groups = new Map<string, Book[]>();
  // 1순위: 올해 완독 중 장르 있는 책
  for (const b of finishedThisYear) {
    const g = normalizeGenre(b.genre);
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(b);
  }
  // 2순위: 전체에서 보강
  for (const b of allBooks) {
    const g = normalizeGenre(b.genre);
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, []);
    if (!groups.get(g)!.includes(b)) groups.get(g)!.push(b);
  }

  const shelves: { name: string; reason: string; books: Book[] }[] = [];
  groups.forEach((books, genre) => {
    if (books.length < 2) return;
    shelves.push({
      name: `${genre} 쉘프`,
      reason: GENRE_REASONS[genre] ?? `${genre} 장르로 묶은 리스트예요.`,
      books: books.slice(0, 12),
    });
  });
  // 많은 순
  shelves.sort((a, b) => b.books.length - a.books.length);
  return shelves.slice(0, 6);
}

function normalizeGenre(g: string | null): string | null {
  if (!g) return null;
  const trimmed = g.trim();
  if (!trimmed) return null;
  // 한글/영문 전부 그대로 쓰되 너무 긴 건 잘라요
  return trimmed.length > 14 ? trimmed.slice(0, 14) : trimmed;
}

const GENRE_REASONS: Record<string, string> = {
  소설: "서사의 결을 따라가고 싶을 때 꺼내는 리스트예요.",
  에세이: "혼자 있는 저녁, 곁에 두고 싶은 문장들.",
  시: "짧은 호흡으로 깊이 읽고 싶을 때.",
  인문: "생각을 밀어 올려 주는 책들.",
  과학: "세상을 다시 보게 해주는 렌즈.",
  역사: "시대의 결을 따라가는 여정.",
  철학: "물음표가 많아지는 밤에 펼치는 책.",
  자기계발: "흐름을 바꾸고 싶을 때 손에 드는 리스트.",
  경제: "숫자 너머의 문맥을 읽는 연습.",
  예술: "눈과 마음의 해상도를 올리는 책.",
  여행: "떠나지 않고도 먼 곳을 걷는 법.",
  SF: "가능성의 지평을 넓히는 문장들.",
  판타지: "현실 바깥을 탐험하고 싶을 때.",
  미스터리: "이야기의 매듭을 풀고 싶은 주말.",
  동화: "잊고 있던 마음을 되찾는 페이지.",
};
