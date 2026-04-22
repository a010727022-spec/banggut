"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, BookOpen, Bookmark, PenLine, Clock, AlertTriangle, RefreshCw, Tag, Calendar as CalendarIcon, Users } from "lucide-react";
import { type CalEvent } from "@/components/shared/ReadingCalendar";
import CalendarSheet from "@/components/shared/CalendarSheet";
import { EmptyState } from "@/components/shared/EmptyState";
import GreetingBar from "@/components/home/GreetingBar";
import ContinueHeroCard from "@/components/home/ContinueHeroCard";
import ContinueCompactCard from "@/components/home/ContinueCompactCard";
import HomeCalendarWidget from "@/components/home/HomeCalendarWidget";
import FriendsFeed, { type GroupScrapShape } from "@/components/home/FriendsFeed";
// date-fns format moved to AppHeader
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { useHomeLayoutStore, type HomeLayout } from "@/stores/useHomeLayoutStore";
import { getBooks, getAllStreakDates, getScraps, getGroupScraps } from "@/lib/supabase/queries";
import { coverPalette } from "@/lib/reading-utils";
import type { Scrap } from "@/lib/types";
// getAvatarSrc moved to AppHeader
import type { Book } from "@/lib/types";

type LibraryTab = "reading" | "done" | "wish" | "scrap";

/* ═══ 유틸 ═══ */
function getProgress(b: Book): number {
  if (b.format === "ebook") return b.progress_percent || 0;
  if (b.total_pages && b.current_page) return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
  if (b.reading_status === "finished") return 100;
  return 0;
}
function upgradeCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace("/cover/", "/cover500/").replace("/cover200/", "/cover500/").replace("/coversum/", "/cover500/").replace("http://", "https://");
}
/* 체온/위젯/Hero 유틸은 components/shared/AppHeader.tsx로 이동 */
/* coverPalette는 lib/reading-utils.ts — 테마 토큰 기반 6 variants (Gail) */

/* ═══ 피처 카드 (읽는 중 — HTML .fc) ═══ */
function FeaturedCard({ book }: { book: Book }) {
  const router = useRouter();
  const coverUrl = upgradeCoverUrl(book.cover_url);
  const [bg, fg] = coverPalette(book.title);
  const progress = getProgress(book);
  const groupName = book.group_books?.reading_groups?.name;

  return (
    <div onClick={() => router.push(`/book/${book.id}`)}
      style={{
        margin: "0 20px 12px", background: "var(--sf)",
        borderRadius: 14, border: "0.5px solid var(--bd)",
        overflow: "hidden", cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.22,1,0.36,1), background 0.4s, border-color 0.4s",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
    >
      <div style={{ display: "flex" }}>
        <div style={{ width: 108, flexShrink: 0, minHeight: 160, position: "relative", overflow: "hidden" }}>
          {coverUrl ? (
            <img src={coverUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg, ${bg}, ${fg})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 1.5, fontWeight: 500 }}>{book.title.slice(0, 8).toUpperCase()}</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, padding: "14px 13px 12px", display: "flex", flexDirection: "column" }}>
          {groupName && (
            <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 5, transition: "color 0.4s" }}>{groupName}</div>
          )}
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.4px", lineHeight: 1.25, transition: "color 0.4s", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{book.title}</div>
          {book.author && <div style={{ fontSize: 11, color: "var(--ts)", marginTop: 3, transition: "color 0.4s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.author}</div>}
          {/* 인용문 (HTML .fc-qt) */}
          {book.one_liner && (
            <div style={{
              marginTop: 10, padding: "8px 10px",
              background: "color-mix(in srgb, var(--ac) 8%, transparent)",
              borderRadius: 8, borderLeft: "2px solid var(--ac)",
              transition: "all 0.4s",
            }}>
              <p style={{ fontSize: 10, color: "var(--ts)", lineHeight: 1.7, fontStyle: "italic", transition: "color 0.4s" }}>
                &ldquo;{book.one_liner}&rdquo;
              </p>
            </div>
          )}
          <div style={{ marginTop: "auto", paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", transition: "color 0.4s" }}>진행률</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ac)", transition: "color 0.4s" }}>{progress}%</span>
            </div>
            <div style={{ height: 3, background: "var(--sf3)", borderRadius: 2, overflow: "hidden", transition: "background 0.4s" }}>
              <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, var(--ac), var(--ac2))", width: `${progress}%`, transition: "width 0.5s, background 0.4s" }} />
            </div>
          </div>
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 14px", borderTop: "0.5px solid var(--bd)",
        background: "var(--sf2)", transition: "all 0.4s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <PenLine size={11} color="var(--ts)" strokeWidth={2} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ts)", transition: "color 0.4s" }}>스크랩</span>
          <Clock size={11} color="var(--ts)" strokeWidth={2} style={{ marginLeft: 8 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ts)", transition: "color 0.4s" }}>{book.current_page ? `p.${book.current_page}` : "시작 전"}</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--acc)", background: "var(--ac)", padding: "5px 12px", borderRadius: 100, transition: "all 0.4s" }}>계속 읽기 →</div>
      </div>
    </div>
  );
}

/* ═══ 그리드 타일 (완독 — HTML .btile) ═══ */
function BookTile({ book }: { book: Book }) {
  const router = useRouter();
  const coverUrl = upgradeCoverUrl(book.cover_url);
  const [bg, fg] = coverPalette(book.title);
  const rating = book.rating ? book.rating.toFixed(1) : null;
  const isFav = book.is_favorite;
  return (
    <div onClick={() => router.push(`/book/${book.id}`)}
      style={{ aspectRatio: "2/3", position: "relative", overflow: "hidden", cursor: "pointer", background: "var(--sf2)", transition: "background 0.4s" }}>
      {coverUrl ? (
        <img src={coverUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg, ${bg}, ${fg})` }} />
      )}
      {/* 별점 or 인생책 뱃지 (우상단) */}
      {(rating || isFav) && (
        <span style={{
          position: "absolute", top: 6, right: 6,
          fontSize: 8, fontWeight: 800,
          padding: "2px 6px", borderRadius: 100,
          background: isFav ? "rgba(224,155,142,0.95)" : "rgba(255,255,255,0.94)",
          color: isFav ? "#fff" : "var(--ac)",
          letterSpacing: "0.2px",
          zIndex: 2,
        }}>
          {isFav ? `♥ ${rating ? "★" + rating : ""}` : `★ ${rating}`}
        </span>
      )}
      <div style={{
        position: "absolute", inset: 0, padding: "9px 8px",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
        background: "linear-gradient(to top, rgba(0,0,0,0.75) 20%, transparent 55%)",
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#ede8e0", lineHeight: 1.3, textShadow: "0 1px 6px rgba(0,0,0,0.9)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{book.title}</div>
          {book.author && <div style={{ fontSize: 9, color: "rgba(220,210,200,0.55)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.author}</div>}
        </div>
      </div>
    </div>
  );
}


/* ═══ 이어 읽을 책이 없을 때 홈 상단 엠프티 스테이트 ═══ */
function ContinueHeroEmpty({ onAdd, compact = false }: { onAdd: () => void; compact?: boolean }) {
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
   메인
═══════════════════════════════════════════ */
export default function LibraryPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { books, setBooks, setLoading } = useLibraryStore();
  useThemeStore();
  const homeLayout = useHomeLayoutStore((s) => s.layout);
  const setHomeLayout = useHomeLayoutStore((s) => s.setLayout);
  const initialTab = ((): LibraryTab => {
    const t = searchParams.get("tab");
    if (t === "wish" || t === "reading" || t === "done" || t === "scrap") return t;
    return "reading";
  })();
  const [tab, setTab] = useState<LibraryTab>(initialTab);
  // Theme A (hero) 내부 세그먼트: calendar | community
  const [heroSeg, setHeroSeg] = useState<"calendar" | "community">("calendar");
  const [finishedSort, setFinishedSort] = useState<"recent" | "rating" | "title">("recent");
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
      // 프로필에서 home_layout 동기화 (DB → 스토어)
      supabase
        .from("profiles")
        .select("home_layout")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => data?.home_layout as HomeLayout | "reading" | "community" | null | undefined),
    ]).then(([booksData, streakData, scrapsData, dbLayout]) => {
      setBooks(booksData);
      setStreakDatesArr(streakData);
      setRecentScraps(scrapsData);
      // DB 값이 구버전(reading/community)이면 새 값으로 마이그레이션된 뒤를 가정
      // 안전하게 현재 값만 받아오고, 유효한 2-옵션이면 스토어에 반영
      if (dbLayout === "hero" || dbLayout === "calendar") {
        setHomeLayout(dbLayout);
      }
    }).catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  }, [user, setBooks, setLoading, retryCount, setHomeLayout]);

  const grouped = useMemo(() => {
    const g = { reading: [] as Book[], done: [] as Book[], want: [] as Book[] };
    for (const b of books) {
      if (b.reading_status === "reading") g.reading.push(b);
      else if (b.reading_status === "finished") g.done.push(b);
      else if (b.reading_status === "want_to_read" || b.reading_status === "to_read") g.want.push(b);
    }
    g.reading.sort((a, b) => (b.group_books ? 1 : 0) - (a.group_books ? 1 : 0));
    return g;
  }, [books]);

  // ═══ 모임 스크랩 피드 (현재 읽는 중 책 중 group_books가 있는 첫 책) ═══
  const groupBookIdForFeed = useMemo(() => {
    const withGroup = grouped.reading.find((b) => b.group_books?.id);
    return withGroup?.group_books?.id || null;
  }, [grouped.reading]);

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

  const sortedDone = useMemo(() => {
    const list = [...grouped.done];
    switch (finishedSort) {
      case "recent":
        list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case "rating":
        list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "title":
        list.sort((a, b) => a.title.localeCompare(b.title, "ko"));
        break;
    }
    return list;
  }, [grouped.done, finishedSort]);

  const counts = { reading: grouped.reading.length, done: grouped.done.length, want: grouped.want.length };

  const TABS: { id: LibraryTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "reading", label: "읽는 중", icon: <BookOpen size={11} strokeWidth={2.5} />, count: counts.reading },
    { id: "done", label: "완독", count: counts.done, icon: null },
    { id: "wish", label: "위시", count: counts.want, icon: null },
    { id: "scrap", label: "스크랩", icon: <PenLine size={11} strokeWidth={2.5} /> },
  ];

  // ═══ MascotHero 컨텍스트 ═══
  const currentBook = useMemo(() =>
    [...grouped.reading].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] || null,
    [grouped.reading]
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
          meta: b.ownership_type === "borrowed" ? "도서관 대여 예정" : undefined,
          targetId: b.id,
        });
      }
      // 도서관 반납일 (완독 전 책)
      if (b.due_date && b.due_date >= todayIso && b.reading_status !== "finished") {
        out.push({
          date: b.due_date,
          type: "return",
          title: `도서관 반납 · 《${b.title}》`,
          meta: b.borrowed_from || undefined,
          targetId: b.id,
        });
      }
      // 모임 마감일 (모임 진행 중)
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
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 100, transition: "background 0.4s" }}>

      {/* 헤더 제거 — 방긋이 히어로가 상단을 담당 */}

      {/* ═══ ERROR STATE ═══ */}
      {loadError && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "60px 20px", textAlign: "center",
        }}>
          <AlertTriangle size={40} color="var(--ts)" strokeWidth={1.5} style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tp)", marginBottom: 6 }}>
            서재를 불러올 수 없어요
          </div>
          <div style={{ fontSize: 13, color: "var(--ts)", marginBottom: 20 }}>
            네트워크 연결을 확인해주세요
          </div>
          <button
            onClick={() => { setLoadError(false); setRetryCount((c) => c + 1); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 100,
              background: "var(--ac)", color: "var(--acc)",
              fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
              transition: "opacity 0.2s",
            }}
          >
            <RefreshCw size={14} strokeWidth={2.5} />
            다시 시도
          </button>
        </div>
      )}

      {/* ═══ 홈 상단 — 레이아웃 테마별 조건부 렌더 ═══ */}
      {!loadError && (
        <div style={{ padding: "0 20px" }}>
          <GreetingBar />

          {homeLayout === "hero" ? (
            <>
              {/* 테마 A: 이어 읽기 HERO */}
              {currentBook ? (
                <ContinueHeroCard book={currentBook} lastScrap={recentScraps[0] || null} />
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
                  transition: "background var(--duration-slow) var(--easing-default)",
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
                        transition: "all var(--duration-fast) var(--easing-default)",
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
                <ContinueHeroEmpty onAdd={() => router.push("/setup")} compact />
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

      {/* ═══ TABS · 애니메이션 언더라인 ═══ */}
      {!loadError && (
        <div style={{
          display: "flex",
          padding: "0 20px",
          overflowX: "auto",
          borderBottom: "0.5px solid var(--bd)",
          gap: 18,
        }} className="scrollbar-hide">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "12px 4px",
                  fontSize: 14,
                  fontWeight: on ? 700 : 500,
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  border: "none",
                  background: "transparent",
                  color: on ? "var(--tp)" : "var(--tm)",
                  transition: "color 0.25s",
                  fontFamily: "'Pretendard', sans-serif",
                  userSelect: "none",
                  position: "relative",
                  flexShrink: 0,
                }}>
                {t.icon}
                {t.label}
                {t.count != null && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 100,
                    padding: "2px 7px",
                    minWidth: 18,
                    textAlign: "center",
                    background: on ? "color-mix(in srgb, var(--ac) 15%, transparent)" : "var(--sf2)",
                    color: on ? "var(--ac)" : "var(--tm)",
                    transition: "all 0.2s",
                  }}>{t.count}</span>
                )}
                {/* 언더라인 인디케이터 */}
                <span
                  style={{
                    position: "absolute",
                    bottom: -0.5,
                    left: 0,
                    right: 0,
                    height: 2.5,
                    background: on ? "linear-gradient(90deg, var(--ac), var(--ac2))" : "transparent",
                    borderRadius: 2,
                    boxShadow: on ? "0 2px 8px color-mix(in srgb, var(--ac) 40%, transparent)" : "none",
                    transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}


      {!loadError && tab === "reading" && (
        <div style={{ animation: "pageIn 0.22s cubic-bezier(0.22,1,0.36,1)" }}>
          {grouped.reading.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="아직 읽는 책이 없어요"
              description="첫 번째 책을 추가하고 독서 여정을 시작해보세요"
              ctaLabel="책 추가하기"
              onCta={() => router.push("/setup")}
            />
          ) : (
            <>
              <div style={{ padding: "4px 20px 8px", fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", transition: "color 0.4s" }}>지금 읽고 있어요</div>
              {grouped.reading.map((b) => <FeaturedCard key={b.id} book={b} />)}

              {/* 최근 그은 문장 (HTML .hl 카드) */}
              {recentScraps.length > 0 && (
                <>
                  <div style={{ padding: "12px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", transition: "color 0.4s" }}>최근 그은 문장</span>
                    <span onClick={() => router.push("/scrap")} style={{ fontSize: 11, fontWeight: 700, color: "var(--ac)", cursor: "pointer", transition: "color 0.4s" }}>전체 →</span>
                  </div>
                  <div style={{ padding: "4px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {recentScraps.slice(0, 2).map((s) => {
                      const scrapBook = books.find((b) => b.id === s.book_id);
                      return (
                        <div key={s.id}
                          onClick={() => router.push(`/book/${s.book_id}`)}
                          style={{
                            background: "var(--sf)", borderRadius: 14,
                            border: "0.5px solid var(--bd)", padding: "12px 14px",
                            cursor: "pointer", transition: "all 0.2s, background 0.4s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sf2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--sf)")}
                        >
                          <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "0.8px", marginBottom: 6, transition: "color 0.4s" }}>
                            {scrapBook?.title || "책"} {s.page_number ? `· p.${s.page_number}` : ""}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--tp)", lineHeight: 1.7, fontStyle: "italic", transition: "color 0.4s" }}>
                            &ldquo;{s.text}&rdquo;
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                            <span style={{ fontSize: 10, color: "var(--tm)", transition: "color 0.4s" }}>
                              {new Date(s.created_at).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {!loadError && tab === "done" && (
        <div style={{ animation: "pageIn 0.22s cubic-bezier(0.22,1,0.36,1)" }}>
          {/* 인스타 프로필 헤더 */}
          {counts.done > 0 && (() => {
            const favCount = grouped.done.filter((b) => b.is_favorite).length;
            const rated = grouped.done.filter((b) => b.rating);
            const avgRating = rated.length > 0 ? (rated.reduce((s, b) => s + (b.rating || 0), 0) / rated.length).toFixed(1) : null;
            return (
              <div style={{ padding: "4px 20px 12px", display: "flex", gap: 14, alignItems: "center", borderBottom: "0.5px solid var(--bd)" }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg, var(--ac3, #A4D4C0), var(--ac))", padding: 2, flexShrink: 0, boxShadow: "0 0 0 2px var(--ac2, #7ABBA4)" }}>
                  <img src="/mascot-happy.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", background: "var(--bg)", borderRadius: "50%" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 18, marginBottom: 4 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.3px", lineHeight: 1 }}>{counts.done}</div>
                      <div style={{ fontSize: 9.5, color: "var(--tm)", fontWeight: 600, marginTop: 3 }}>완독</div>
                    </div>
                    {avgRating && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.3px", lineHeight: 1 }}>★ {avgRating}</div>
                        <div style={{ fontSize: 9.5, color: "var(--tm)", fontWeight: 600, marginTop: 3 }}>평균</div>
                      </div>
                    )}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.3px", lineHeight: 1 }}>{favCount}</div>
                      <div style={{ fontSize: 9.5, color: "var(--tm)", fontWeight: 600, marginTop: 3 }}>인생책</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Gaegu', cursive", fontSize: 13, color: "var(--ts)", lineHeight: 1.4, letterSpacing: "0.02em" }}>
                    {new Date().getFullYear()}년 <span style={{ color: "var(--ac)", fontWeight: 700, fontStyle: "normal" }}>{counts.done}권째</span>
                  </div>
                </div>
              </div>
            );
          })()}
          {/* 정렬 */}
          <div style={{ padding: "10px 20px", display: "flex", gap: 6, overflowX: "auto" as const }}>
            {([
              { id: "recent", label: "최근순" },
              { id: "rating", label: "별점순" },
              { id: "title", label: "제목순" },
            ] as const).map((s) => {
              const on = finishedSort === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setFinishedSort(s.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    border: on ? "0.5px solid var(--ac)" : "0.5px solid var(--bd2)",
                    background: on ? "var(--ac)" : "transparent",
                    color: on ? "var(--acc)" : "var(--tm)",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {counts.done === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="아직 완독한 책이 없어요"
              description="한 권을 끝까지 읽으면 완독 서가에 꽂혀요"
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
              {sortedDone.map((b) => <BookTile key={b.id} book={b} />)}
              <div onClick={() => router.push("/setup")}
                style={{
                  aspectRatio: "2/3", background: "transparent",
                  border: "1px dashed color-mix(in srgb, var(--ac) 25%, transparent)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", gap: 7, transition: "all 0.2s",
                }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid color-mix(in srgb, var(--ac) 35%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={14} stroke="var(--ac)" strokeWidth={2.5} style={{ opacity: 0.5 }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", transition: "color 0.4s" }}>추가</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!loadError && tab === "wish" && (
        <div style={{ animation: "pageIn 0.22s cubic-bezier(0.22,1,0.36,1)" }}>
          {grouped.want.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="위시리스트가 비어있어요"
              description="읽고 싶은 책을 저장해두면 잊지 않고 만날 수 있어요"
              ctaLabel="책 담기"
              onCta={() => router.push("/setup")}
            />
          ) : (
            <>
              {/* 통계 스트립 (클레이 민트 칩) */}
              {(() => {
                const today = new Date().toISOString().slice(0, 10);
                const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
                const soon = grouped.want.filter((b) => b.plan_to_start_at && b.plan_to_start_at >= today && b.plan_to_start_at <= weekFromNow).length;
                const genres = new Set(grouped.want.map((b) => b.genre).filter(Boolean)).size;
                const MINT_TOP = "#62C9A6";
                const MINT_BOT = "#2F9E74";
                const MINT_DEEP = "#1F7B5A";
                type Stat = { icon: typeof Bookmark; value: number; label: string; accent: boolean };
                const stats: Stat[] = [
                  { icon: Bookmark, value: counts.want, label: "위시", accent: counts.want > 0 },
                  { icon: Clock, value: soon, label: "곧 시작", accent: soon > 0 },
                  { icon: Tag, value: genres, label: "장르", accent: false },
                ];
                return (
                  <div
                    style={{
                      padding: "6px 20px 10px",
                      display: "flex",
                      gap: 6,
                      alignItems: "stretch",
                    }}
                  >
                    {stats.map((s) => {
                      const Icon = s.icon;
                      return (
                        <div
                          key={s.label}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            padding: "7px 10px 7px 8px",
                            borderRadius: 12,
                            background: s.accent
                              ? "linear-gradient(180deg, color-mix(in srgb, var(--sf) 86%, " + MINT_TOP + " 14%) 0%, color-mix(in srgb, var(--sf) 94%, " + MINT_BOT + " 6%) 100%)"
                              : "linear-gradient(180deg, color-mix(in srgb, var(--sf) 94%, #ffffff 6%) 0%, var(--sf) 100%)",
                            border: s.accent
                              ? "0.5px solid color-mix(in srgb, var(--bd) 40%, " + MINT_TOP + " 60%)"
                              : "0.5px solid var(--bd)",
                            boxShadow: s.accent
                              ? "inset 0 0.5px 0 rgba(255,255,255,0.65), 0 1px 3px color-mix(in srgb, " + MINT_TOP + " 18%, rgba(50,40,25,0.04))"
                              : "inset 0 0.5px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(50,40,25,0.04)",
                            minWidth: 0,
                          }}
                        >
                          {/* 클레이 스퀘어클 아이콘 타일 */}
                          <span
                            aria-hidden
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 8,
                              background: s.accent
                                ? `linear-gradient(135deg, ${MINT_TOP} 0%, ${MINT_BOT} 100%)`
                                : "linear-gradient(135deg, color-mix(in srgb, var(--tm) 16%, var(--bg)) 0%, color-mix(in srgb, var(--tm) 26%, var(--bg)) 100%)",
                              boxShadow: s.accent
                                ? "inset 0 0.8px 0 rgba(255,255,255,0.5), " +
                                  `inset 0 -0.8px 0 color-mix(in srgb, ${MINT_DEEP} 45%, transparent), ` +
                                  `0 2px 4px color-mix(in srgb, ${MINT_TOP} 28%, transparent)`
                                : "inset 0 0.5px 0 rgba(255,255,255,0.35), inset 0 -0.5px 0 rgba(0,0,0,0.06)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Icon
                              size={13}
                              strokeWidth={2.3}
                              color="#ffffff"
                              fill={s.accent ? "rgba(255,255,255,0.22)" : "transparent"}
                              style={{
                                filter: s.accent
                                  ? `drop-shadow(0 0.5px 0.5px color-mix(in srgb, ${MINT_DEEP} 60%, transparent))`
                                  : "drop-shadow(0 0.5px 0.5px rgba(0,0,0,0.1))",
                              }}
                            />
                          </span>
                          {/* 숫자 + 라벨 */}
                          <span
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              gap: 0,
                              minWidth: 0,
                              lineHeight: 1,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "var(--font-playful)",
                                fontSize: 17,
                                fontWeight: 700,
                                color: s.accent ? MINT_DEEP : "var(--tp)",
                                letterSpacing: "-0.02em",
                                fontVariantNumeric: "tabular-nums",
                                lineHeight: 1,
                              }}
                            >
                              {s.value}
                            </span>
                            <span
                              style={{
                                fontSize: 9.5,
                                color: "var(--tm)",
                                fontWeight: 600,
                                marginTop: 2,
                                letterSpacing: "0.02em",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {s.label}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* 그리드 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginTop: 2 }}>
                {[...grouped.want]
                  .sort((a, b) => {
                    // 시작 예정 있는 것 먼저, 날짜 가까운 순
                    if (a.plan_to_start_at && b.plan_to_start_at) return a.plan_to_start_at.localeCompare(b.plan_to_start_at);
                    if (a.plan_to_start_at) return -1;
                    if (b.plan_to_start_at) return 1;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  })
                  .map((b) => {
                    const coverUrl = upgradeCoverUrl(b.cover_url);
                    const [bg, fg] = coverPalette(b.title);
                    const todayIso = new Date().toISOString().slice(0, 10);
                    let planBadge: string | null = null;
                    if (b.plan_to_start_at) {
                      const daysUntil = Math.ceil((new Date(b.plan_to_start_at).getTime() - new Date(todayIso).getTime()) / (1000 * 60 * 60 * 24));
                      if (daysUntil <= 0) planBadge = "📖 지금";
                      else if (daysUntil === 1) planBadge = "📅 D-1";
                      else if (daysUntil <= 7) planBadge = `📅 D-${daysUntil}`;
                      else {
                        const d = new Date(b.plan_to_start_at);
                        planBadge = `📅 ${d.getMonth() + 1}/${d.getDate()}`;
                      }
                    }
                    return (
                      <div
                        key={b.id}
                        onClick={() => router.push(`/book/${b.id}`)}
                        style={{ aspectRatio: "2/3", position: "relative", overflow: "hidden", cursor: "pointer", background: "var(--sf2)" }}
                      >
                        {coverUrl ? (
                          <img src={coverUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg, ${bg}, ${fg})` }} />
                        )}
                        {planBadge && (
                          <span
                            style={{
                              position: "absolute",
                              top: 6,
                              right: 6,
                              fontSize: 8,
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: 100,
                              background: "rgba(183,149,86,0.95)",
                              color: "#fff",
                              letterSpacing: "0.2px",
                              zIndex: 2,
                            }}
                          >
                            {planBadge}
                          </span>
                        )}
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            padding: "9px 8px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                            background: "linear-gradient(to top, rgba(0,0,0,0.75) 20%, transparent 55%)",
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#ede8e0", lineHeight: 1.3, textShadow: "0 1px 6px rgba(0,0,0,0.9)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.title}</div>
                          {b.author && <div style={{ fontSize: 9, color: "rgba(220,210,200,0.55)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.author}</div>}
                        </div>
                      </div>
                    );
                  })}
                <div
                  onClick={() => router.push("/setup")}
                  style={{
                    aspectRatio: "2/3",
                    background: "transparent",
                    border: "1px dashed color-mix(in srgb, var(--ac) 25%, transparent)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    gap: 7,
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid color-mix(in srgb, var(--ac) 35%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={14} stroke="var(--ac)" strokeWidth={2.5} style={{ opacity: 0.5 }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase" }}>추가</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!loadError && tab === "scrap" && (
        <div style={{ animation: "pageIn 0.22s cubic-bezier(0.22,1,0.36,1)" }}>
          <div style={{ padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", transition: "color 0.4s" }}>
              그은 문장 {recentScraps.length}개
            </span>
            <span onClick={() => router.push("/scrap")} style={{ fontSize: 11, fontWeight: 700, color: "var(--ac)", cursor: "pointer" }}>책별 보기</span>
          </div>
          {recentScraps.length === 0 ? (
            <EmptyState
              icon={PenLine}
              title="아직 그은 문장이 없어요"
              description="책을 읽으며 마음에 드는 문장을 스크랩해보세요"
            />
          ) : (
            recentScraps.map((s) => {
              const scrapBook = books.find((b) => b.id === s.book_id);
              return (
                <div key={s.id}
                  onClick={() => router.push(`/book/${s.book_id}`)}
                  style={{
                    display: "flex", gap: 12, padding: "14px 20px",
                    borderBottom: "0.5px solid var(--bd)",
                    cursor: "pointer", transition: "background 0.15s, border-color 0.4s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sf)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {/* 색상 점 */}
                  <div style={{
                    width: 4, borderRadius: 2, flexShrink: 0, marginTop: 3,
                    background: "var(--ac)", height: 52,
                    transition: "background 0.4s",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "0.8px", marginBottom: 5, transition: "color 0.4s" }}>
                      {scrapBook?.title || "책"} · {scrapBook?.author || ""}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--tp)", lineHeight: 1.7, fontStyle: "italic", transition: "color 0.4s" }}>
                      &ldquo;{s.text}&rdquo;
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                      <span style={{ fontSize: 10, color: "var(--tm)", fontWeight: 600, transition: "color 0.4s" }}>
                        {s.page_number ? `p.${s.page_number}` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
