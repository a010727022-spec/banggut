"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { getBooks } from "@/lib/supabase/queries";
import { PHASES } from "@/lib/types";

import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, Calendar, BookOpen, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, subMonths, addMonths, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

type Tab = "calendar" | "library" | "stats";
type LibraryFilter = "all" | "to_read" | "reading" | "done";

export default function LibraryPage() {
  const user = useAuthStore((s) => s.user);
  const { books, setBooks, isLoading } = useLibraryStore();
  const [activeTab, setActiveTab] = useState<Tab>("library");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    getBooks(supabase, user.id).then(setBooks);
  }, [user, setBooks]);

  // --- Calendar data ---
  const calendarData: Record<string, { emoji: string; count: number }> = {};
  for (const book of books) {
    const phaseIcon = PHASES[book.phase]?.icon || "📖";
    for (const dateStr of [book.created_at, book.updated_at]) {
      if (!dateStr) continue;
      const key = format(parseISO(dateStr), "yyyy-MM-dd");
      if (calendarData[key]) {
        calendarData[key].count += 1;
      } else {
        calendarData[key] = { emoji: phaseIcon, count: 1 };
      }
    }
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  // --- Resolve reading_status with phase-based fallback ---
  function resolveStatus(b: (typeof books)[number]) {
    if (b.reading_status) return b.reading_status;
    if (b.phase === 3 || b.has_review) return "finished" as const;
    if (b.phase >= 0 && b.phase <= 2) return "reading" as const;
    return "to_read" as const;
  }

  // --- Library filters ---
  const toReadBooks = books.filter((b) => resolveStatus(b) === "to_read");
  const readingBooks = books.filter((b) => resolveStatus(b) === "reading");
  const doneBooks = books.filter((b) => resolveStatus(b) === "finished");
  const filteredBooks =
    libraryFilter === "to_read"
      ? toReadBooks
      : libraryFilter === "reading"
        ? readingBooks
        : libraryFilter === "done"
          ? doneBooks
          : books;

  // --- Stats ---
  const totalMessages = books.reduce((sum, b) => sum + (b.message_count ?? 0), 0);
  const hasMessageData = books.some((b) => typeof b.message_count === "number");

  // --- Segment control tabs ---
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "calendar", label: "캘린더", icon: <Calendar className="w-3.5 h-3.5" /> },
    { key: "library", label: "서재", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { key: "stats", label: "통계", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="px-4 pt-6 pb-24">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-black text-ink-green">
          {user?.emoji} {user?.nickname}의 서재
        </h1>
        <p className="text-xs text-warmgray mt-0.5">읽고, 긋고, 방긋.</p>
      </div>

      {/* Segment Control */}
      <div className="flex bg-warm rounded-full border border-[rgba(43,76,63,0.08)] p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-full transition-all ${
              activeTab === tab.key
                ? "bg-ink-green text-paper shadow-sm"
                : "text-warmgray hover:text-ink-green"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== CALENDAR MODE ==================== */}
      {activeTab === "calendar" && (
        <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-btn hover:bg-ink-green/5 active:bg-ink-green/10"
            >
              <ChevronLeft className="w-4 h-4 text-warmgray" />
            </button>
            <span className="text-sm font-semibold text-ink-green">
              {format(currentMonth, "yyyy년 M월", { locale: ko })}
            </span>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-btn hover:bg-ink-green/5 active:bg-ink-green/10"
            >
              <ChevronRight className="w-4 h-4 text-warmgray" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-warmgray mb-1">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const data = calendarData[key];
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={key}
                  className={`aspect-square flex items-center justify-center rounded-md text-xs ${
                    isToday ? "ring-1 ring-ink-green" : ""
                  } ${data ? "bg-ink-green/10" : "bg-transparent"}`}
                >
                  {data?.emoji || format(day, "d")}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== LIBRARY MODE ==================== */}
      {activeTab === "library" && (
        <div>
          {/* Sub-tabs */}
          <div className="flex gap-4 mb-4 border-b border-[rgba(43,76,63,0.06)]">
            {(
              [
                { key: "all", label: "전체" },
                { key: "to_read", label: "읽을 책" },
                { key: "reading", label: "읽는 중" },
                { key: "done", label: "읽은 책" },
              ] as const
            ).map((ft) => (
              <button
                key={ft.key}
                onClick={() => setLibraryFilter(ft.key)}
                className={`pb-2 text-sm font-semibold transition-colors ${
                  libraryFilter === ft.key
                    ? "text-ink-green border-b-2 border-ink-green"
                    : "text-warmgray-light"
                }`}
              >
                {ft.label}
              </button>
            ))}
          </div>

          {/* Book grid */}
          {isLoading ? (
            <div className="text-center text-warmgray py-12 text-sm">
              불러오는 중...
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-warmgray text-sm mb-4">
                {libraryFilter === "all"
                  ? "아직 등록된 책이 없어요"
                  : libraryFilter === "to_read"
                    ? "읽을 책이 없어요"
                    : libraryFilter === "reading"
                      ? "읽고 있는 책이 없어요"
                      : "완독한 책이 없어요"}
              </p>
              {libraryFilter === "all" && (
                <Link
                  href="/setup"
                  className="inline-flex items-center gap-1 text-sm text-ink-green font-semibold hover:underline"
                >
                  <Plus className="w-4 h-4" /> 첫 책 등록하기
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filteredBooks.map((book) => {
                const isDropped = resolveStatus(book) === "dropped";
                const progress =
                  book.current_page && book.total_pages
                    ? Math.min(
                        Math.round((book.current_page / book.total_pages) * 100),
                        100,
                      )
                    : null;
                return (
                  <Link
                    key={book.id}
                    href={`/book/${book.id}`}
                    className={`bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-3 hover:shadow-md transition-shadow contain-paint${isDropped && libraryFilter === "all" ? " opacity-50" : ""}`}
                  >
                    {/* Cover */}
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-full aspect-[3/4] object-cover rounded-md mb-2"
                      />
                    ) : (
                      <div
                        className="aspect-[3/4] rounded-md flex items-center justify-center mb-2"
                        style={{
                          backgroundColor: `${PHASES[book.phase]?.color || "#2B4C3F"}12`,
                        }}
                      >
                        <span className="text-2xl">
                          {PHASES[book.phase]?.icon || "📖"}
                        </span>
                      </div>
                    )}

                    {/* Progress bar */}
                    {progress !== null && (
                      <div className="w-full h-1 bg-ink-green/10 rounded-full mb-2 overflow-hidden">
                        <div
                          className="h-full bg-ink-green rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}

                    {/* Info */}
                    <p className="text-xs font-semibold text-ink truncate">
                      {book.title}
                    </p>
                    <p className="text-[10px] text-warmgray truncate">
                      {book.author}
                    </p>

                    {/* Rating */}
                    {book.rating != null && (
                      <p
                        className="text-[10px] font-semibold mt-0.5"
                        style={{ color: "#C4A35A" }}
                      >
                        ★{book.rating.toFixed(1)}
                      </p>
                    )}

                    {/* Phase badge */}
                    <span
                      className="inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded-badge font-semibold text-paper"
                      style={{
                        backgroundColor: PHASES[book.phase]?.color || "#2B4C3F",
                      }}
                    >
                      {PHASES[book.phase]?.label || "수집중"}
                    </span>

                    {/* Phase progress dots */}
                    <div className="flex gap-1 mt-1.5">
                      {PHASES.map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            i <= book.phase
                              ? "bg-ink-green"
                              : "bg-ink-green/15"
                          }`}
                        />
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== STATS MODE ==================== */}
      {activeTab === "stats" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
            <div className="text-2xl mb-1">📚</div>
            <p className="text-[11px] text-warmgray mb-0.5">전체</p>
            <p className="text-xl font-black text-ink-green">
              {books.length}
              <span className="text-sm font-semibold ml-0.5">권</span>
            </p>
          </div>
          <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
            <div className="text-2xl mb-1">📖</div>
            <p className="text-[11px] text-warmgray mb-0.5">읽는 중</p>
            <p className="text-xl font-black text-ink-green">
              {readingBooks.length}
              <span className="text-sm font-semibold ml-0.5">권</span>
            </p>
          </div>
          <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
            <div className="text-2xl mb-1">✅</div>
            <p className="text-[11px] text-warmgray mb-0.5">완독</p>
            <p className="text-xl font-black text-ink-green">
              {doneBooks.length}
              <span className="text-sm font-semibold ml-0.5">권</span>
            </p>
          </div>
          <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
            <div className="text-2xl mb-1">💬</div>
            <p className="text-[11px] text-warmgray mb-0.5">총 토론</p>
            <p className="text-xl font-black text-ink-green">
              {hasMessageData ? totalMessages : "-"}
              <span className="text-sm font-semibold ml-0.5">턴</span>
            </p>
          </div>
        </div>
      )}

      {/* FAB */}
      <Link
        href="/setup"
        className="fixed bottom-20 right-4 w-14 h-14 bg-ink-green text-paper rounded-full flex items-center justify-center shadow-lg hover:bg-ink-medium active:bg-ink-dark transition-colors z-30"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}
