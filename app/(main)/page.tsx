"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  BookOpen,
  AlertTriangle,
  RefreshCw,
  Calendar as CalendarIcon,
  Users,
} from "lucide-react";
import { type CalEvent } from "@/components/shared/ReadingCalendar";
import CalendarSheet from "@/components/shared/CalendarSheet";
import GreetingBar from "@/components/home/GreetingBar";
import ContinueHeroCard from "@/components/home/ContinueHeroCard";
import ContinueCompactCard from "@/components/home/ContinueCompactCard";
import HomeCalendarWidget from "@/components/home/HomeCalendarWidget";
import FriendsFeed, { type GroupScrapShape } from "@/components/home/FriendsFeed";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { useHomeLayoutStore, type HomeLayout } from "@/stores/useHomeLayoutStore";
import {
  getBooks,
  getAllStreakDates,
  getScraps,
  getGroupScraps,
} from "@/lib/supabase/queries";
import type { Scrap } from "@/lib/types";

/* ═══ 이어 읽을 책이 없을 때 홈 상단 엠프티 스테이트 ═══ */
function ContinueHeroEmpty({
  onAdd,
  compact = false,
}: {
  onAdd: () => void;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        background:
          "linear-gradient(155deg, color-mix(in srgb, var(--ac) 15%, var(--sf)) 0%, var(--sf) 100%)",
        borderRadius: compact ? 18 : 22,
        padding: compact ? 16 : 18,
        marginBottom: compact ? 8 : 14,
        border: "0.5px solid var(--bd)",
        display: "flex",
        gap: 14,
        alignItems: "center",
        transition:
          "background var(--duration-slow) var(--easing-default), border-color var(--duration-slow) var(--easing-default)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          minWidth: 56,
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--ac) 18%, var(--sf))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <BookOpen size={24} color="var(--ac)" strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--tp)",
            letterSpacing: "-0.015em",
            lineHeight: 1.35,
            marginBottom: 2,
          }}
        >
          읽고 있는 책이 없어요
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ts)", lineHeight: 1.45 }}>
          첫 책을 담으면 여기에 이어 읽기 카드가 나타나요
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        aria-label="책 추가하기"
        style={{
          background: "var(--ac)",
          color: "var(--acc)",
          border: "none",
          padding: "10px 14px",
          borderRadius: 100,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          minHeight: 36,
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
        }}
      >
        <Plus size={13} strokeWidth={2.5} />
        담기
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   메인 (홈)
   - 4-탭 서재(읽는 중·완독·위시·스크랩)는 /library 로 이관됐어요.
   - 홈은 "인사 + 이어 읽기 + 캘린더/커뮤니티"에 집중합니다.
═══════════════════════════════════════════ */
export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { books, setBooks, setLoading } = useLibraryStore();
  useThemeStore();
  const homeLayout = useHomeLayoutStore((s) => s.layout);
  const setHomeLayout = useHomeLayoutStore((s) => s.setLayout);

  // 테마 A(hero) 내부 세그먼트 — 캘린더 ↔ 커뮤니티
  const [heroSeg, setHeroSeg] = useState<"calendar" | "community">("calendar");
  const [streakDatesArr, setStreakDatesArr] = useState<string[]>([]);
  const [recentScraps, setRecentScraps] = useState<Scrap[]>([]);
  const [groupScraps, setGroupScraps] = useState<GroupScrapShape[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadError(false);
    const supabase = createClient();
    Promise.all([
      getBooks(supabase, user.id),
      getAllStreakDates(supabase, user.id),
      getScraps(supabase, user.id, 4),
      // 프로필 home_layout 동기화 (DB → 스토어)
      supabase
        .from("profiles")
        .select("home_layout")
        .eq("id", user.id)
        .maybeSingle()
        .then(
          ({ data }) =>
            data?.home_layout as
              | HomeLayout
              | "reading"
              | "community"
              | null
              | undefined
        ),
    ])
      .then(([booksData, streakData, scrapsData, dbLayout]) => {
        setBooks(booksData);
        setStreakDatesArr(streakData);
        setRecentScraps(scrapsData);
        if (dbLayout === "hero" || dbLayout === "calendar") {
          setHomeLayout(dbLayout);
        }
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  }, [user, setBooks, setLoading, retryCount, setHomeLayout]);

  // 읽는 중 책만 따로 — 이어 읽기 카드 + 모임 피드에 사용
  const readingBooks = useMemo(() => {
    const list = books.filter((b) => b.reading_status === "reading");
    list.sort((a, b) => (b.group_books ? 1 : 0) - (a.group_books ? 1 : 0));
    return list;
  }, [books]);

  // ═══ 모임 스크랩 피드 (읽는 중 책 중 group_books 있는 첫 책) ═══
  const groupBookIdForFeed = useMemo(() => {
    const withGroup = readingBooks.find((b) => b.group_books?.id);
    return withGroup?.group_books?.id || null;
  }, [readingBooks]);

  useEffect(() => {
    if (!user || !groupBookIdForFeed) {
      setGroupScraps([]);
      return;
    }
    const supabase = createClient();
    getGroupScraps(supabase, groupBookIdForFeed)
      .then((rows) => setGroupScraps(rows.slice(0, 6)))
      .catch(() => setGroupScraps([]));
  }, [user, groupBookIdForFeed]);

  // 이어 읽기 HERO 대상 = 가장 최근 업데이트된 '읽는 중' 책
  const currentBook = useMemo(
    () =>
      [...readingBooks].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0] || null,
    [readingBooks]
  );

  // HERO variant 해석용 — 현재 이어 읽기 책의 스크랩만 추려서 V1-B 판별에 사용
  const currentBookScraps = useMemo<Scrap[]>(
    () =>
      currentBook
        ? recentScraps.filter((s) => s.book_id === currentBook.id)
        : [],
    [currentBook, recentScraps]
  );

  const streak = useMemo(() => {
    const set = new Set(streakDatesArr);
    let s = 0;
    const d = new Date();
    while (set.has(d.toISOString().slice(0, 10))) {
      s++;
      d.setDate(d.getDate() - 1);
    }
    return s;
  }, [streakDatesArr]);

  const readingEvents = useMemo<CalEvent[]>(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const out: CalEvent[] = [];
    for (const b of books) {
      // 위시 책 시작일
      if (b.plan_to_start_at && b.plan_to_start_at >= todayIso) {
        out.push({
          date: b.plan_to_start_at,
          type: "wish",
          title: `《${b.title}》 읽기 시작일`,
          meta:
            b.ownership_type === "borrowed" ? "도서관 대여 예정" : undefined,
          targetId: b.id,
        });
      }
      // 도서관 반납일 (완독 전)
      if (b.due_date && b.due_date >= todayIso && b.reading_status !== "finished") {
        out.push({
          date: b.due_date,
          type: "return",
          title: `도서관 반납 · 《${b.title}》`,
          meta: b.borrowed_from || undefined,
          targetId: b.id,
        });
      }
      // 모임 마감일
      if (b.group_books?.end_date && b.group_books.end_date >= todayIso) {
        const gname = b.group_books.reading_groups?.name || "북토크";
        out.push({
          date: b.group_books.end_date,
          type: "meeting",
          title: `${gname} · 《${b.title}》`,
          meta: `${b.group_books.round_number}차 모임 마감`,
          targetId: b.id,
        });
      }
    }
    return out;
  }, [books]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        paddingBottom: 100,
        transition: "background 0.4s",
      }}
    >
      {/* ═══ ERROR STATE ═══ */}
      {loadError && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px",
            textAlign: "center",
          }}
        >
          <AlertTriangle
            size={40}
            color="var(--ts)"
            strokeWidth={1.5}
            style={{ marginBottom: 16 }}
          />
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--tp)",
              marginBottom: 6,
            }}
          >
            홈을 불러올 수 없어요
          </div>
          <div style={{ fontSize: 13, color: "var(--ts)", marginBottom: 20 }}>
            네트워크 연결을 확인해주세요
          </div>
          <button
            onClick={() => {
              setLoadError(false);
              setRetryCount((c) => c + 1);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 100,
              background: "var(--ac)",
              color: "var(--acc)",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
          >
            <RefreshCw size={14} strokeWidth={2.5} />
            다시 시도
          </button>
        </div>
      )}

      {/* ═══ 홈 본문 — 레이아웃 테마별 조건부 렌더 ═══ */}
      {!loadError && (
        <div style={{ padding: "0 20px" }}>
          <GreetingBar />

          {homeLayout === "hero" ? (
            <>
              {/* 테마 A: 이어 읽기 HERO */}
              {currentBook ? (
                <ContinueHeroCard
                  book={currentBook}
                  scrapsForBook={currentBookScraps}
                  lastScrap={recentScraps[0] || null}
                />
              ) : (
                <ContinueHeroEmpty onAdd={() => router.push("/setup")} />
              )}

              {/* 세그먼트 탭: 캘린더 ↔ 커뮤니티 */}
              <div
                role="tablist"
                aria-label="캘린더와 커뮤니티 전환"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 4,
                  background: "var(--sf2)",
                  padding: 4,
                  borderRadius: 14,
                  marginBottom: 14,
                  transition:
                    "background var(--duration-slow) var(--easing-default)",
                }}
              >
                {(["calendar", "community"] as const).map((seg) => {
                  const on = heroSeg === seg;
                  const Icon = seg === "calendar" ? CalendarIcon : Users;
                  const label = seg === "calendar" ? "캘린더" : "커뮤니티";
                  return (
                    <button
                      key={seg}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setHeroSeg(seg)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: on ? 700 : 600,
                        color: on ? "var(--tp)" : "var(--tm)",
                        textAlign: "center",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        transition:
                          "all var(--duration-fast) var(--easing-default)",
                        border: "none",
                        background: on ? "var(--sf)" : "transparent",
                        fontFamily: "inherit",
                        minHeight: 40,
                        letterSpacing: "-0.01em",
                        boxShadow: on
                          ? "0 1px 3px color-mix(in srgb, var(--tp) 8%, transparent)"
                          : "none",
                      }}
                    >
                      <Icon
                        size={14}
                        strokeWidth={2}
                        color={on ? "var(--ac)" : "var(--tm)"}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>

              {heroSeg === "calendar" ? (
                <HomeCalendarWidget
                  readDates={streakDatesArr}
                  events={readingEvents}
                  streak={streak}
                  onCardTap={() => setCalendarOpen(true)}
                  onEventTap={(e) => {
                    if (e.targetId) router.push(`/book/${e.targetId}`);
                  }}
                />
              ) : (
                <FriendsFeed
                  myScraps={recentScraps}
                  groupScraps={groupScraps}
                  books={books}
                  currentUserNickname={user?.nickname}
                  currentUserEmoji={user?.emoji}
                  currentUserId={user?.id}
                  limit={4}
                  onMoreTap={() => router.push("/scrap")}
                  showEmpty
                  onAddScrap={() => router.push("/setup")}
                />
              )}
            </>
          ) : (
            <>
              {/* 테마 B: 캘린더 First */}
              <HomeCalendarWidget
                readDates={streakDatesArr}
                events={readingEvents}
                streak={streak}
                onCardTap={() => setCalendarOpen(true)}
                onEventTap={(e) => {
                  if (e.targetId) router.push(`/book/${e.targetId}`);
                }}
              />
              {currentBook ? (
                <ContinueCompactCard book={currentBook} />
              ) : (
                <ContinueHeroEmpty
                  onAdd={() => router.push("/setup")}
                  compact
                />
              )}
              <FriendsFeed
                myScraps={recentScraps}
                groupScraps={groupScraps}
                books={books}
                currentUserNickname={user?.nickname}
                currentUserEmoji={user?.emoji}
                currentUserId={user?.id}
                limit={3}
                onMoreTap={() => router.push("/scrap")}
                showEmpty
                onAddScrap={() => router.push("/setup")}
              />
            </>
          )}
        </div>
      )}

      {/* ═══ 캘린더 바텀시트 ═══ */}
      <CalendarSheet
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        readDates={streakDatesArr}
        events={readingEvents}
        streak={streak}
        onEventTap={(e) => {
          if (e.targetId) router.push(`/book/${e.targetId}`);
        }}
      />
    </div>
  );
}
