"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { getBooks, getScraps, getReadingSessions, deleteBook } from "@/lib/supabase/queries";
import { PHASES } from "@/lib/types";
import type { Book, Scrap, ReadingSession } from "@/lib/types";

import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, Calendar, BookOpen, BarChart3, X } from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  subMonths,
  addMonths,
  parseISO,
  startOfYear,
  eachMonthOfInterval,
} from "date-fns";
import { ko } from "date-fns/locale";

type Tab = "calendar" | "library" | "stats";
type LibraryFilter = "all" | "want_to_read" | "reading" | "done" | "abandoned";

export default function LibraryPage() {
  const user = useAuthStore((s) => s.user);
  const { books, setBooks, removeBook, isLoading } = useLibraryStore();
  const [activeTab, setActiveTab] = useState<Tab>("library");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPressStart = useCallback((bookId: string) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressId(bookId);
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [sessions, setSessions] = useState<(ReadingSession & { books: Pick<Book, "title" | "author" | "cover_url"> })[]>([]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    getBooks(supabase, user.id).then(setBooks);
    getScraps(supabase, user.id).then(setScraps);
    // 올해 전체 세션
    const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
    getReadingSessions(supabase, user.id, yearStart).then(setSessions);
  }, [user, setBooks]);

  // --- Resolve reading_status with phase-based fallback ---
  function resolveStatus(b: Book) {
    if (b.reading_status) return b.reading_status;
    if (b.phase === 3 || b.has_review) return "finished" as const;
    if (b.phase >= 0 && b.phase <= 2) return "reading" as const;
    return "to_read" as const;
  }

  async function handleDelete(bookId: string) {
    setDeleting(true);
    try {
      const supabase = createClient();
      await deleteBook(supabase, bookId);
      removeBook(bookId);
      toast.success("책을 삭제했어요");
    } catch {
      toast.error("삭제에 실패했어요");
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  // --- Calendar data (scraps + sessions by date) ---
  const calendarData = useMemo(() => {
    const map: Record<string, { books: { title: string; cover_url: string | null }[]; scrapCount: number }> = {};
    // 세션 기반 데이터
    for (const s of sessions) {
      if (!map[s.date]) map[s.date] = { books: [], scrapCount: 0 };
      map[s.date].books.push({ title: s.books.title, cover_url: s.books.cover_url });
    }
    // 스크랩 기반 데이터
    for (const s of scraps) {
      const key = format(parseISO(s.created_at), "yyyy-MM-dd");
      if (!map[key]) map[key] = { books: [], scrapCount: 0 };
      map[key].scrapCount += 1;
    }
    // 책 활동 (created_at, updated_at) 기반 fallback
    for (const book of books) {
      for (const dateStr of [book.created_at, book.updated_at]) {
        if (!dateStr) continue;
        const key = format(parseISO(dateStr), "yyyy-MM-dd");
        if (!map[key]) map[key] = { books: [], scrapCount: 0 };
        if (!map[key].books.find((b) => b.title === book.title)) {
          map[key].books.push({ title: book.title, cover_url: book.cover_url });
        }
      }
    }
    return map;
  }, [books, scraps, sessions]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  // 선택된 날짜의 스크랩
  const selectedDayScraps = useMemo(() => {
    if (!selectedDay) return [];
    return scraps.filter((s) => format(parseISO(s.created_at), "yyyy-MM-dd") === selectedDay);
  }, [scraps, selectedDay]);

  // --- Library filters ---
  const wantBooks = books.filter((b) => resolveStatus(b) === "want_to_read");
  const readingBooks = books.filter((b) => resolveStatus(b) === "reading" || resolveStatus(b) === "to_read");
  const doneBooks = books.filter((b) => resolveStatus(b) === "finished");
  const abandonedBooks = books.filter((b) => resolveStatus(b) === "abandoned" || resolveStatus(b) === "dropped");
  const filteredBooks =
    libraryFilter === "want_to_read"
      ? wantBooks
      : libraryFilter === "reading"
        ? readingBooks
        : libraryFilter === "done"
          ? doneBooks
          : libraryFilter === "abandoned"
            ? abandonedBooks
            : books;

  // --- Monthly Stats ---
  const monthlyCompleted = useMemo(() => {
    const monthKey = format(currentMonth, "yyyy-MM");
    return doneBooks.filter((b) => b.finished_at && b.finished_at.startsWith(monthKey)).length;
  }, [doneBooks, currentMonth]);

  // --- Yearly bar chart data ---
  const yearlyData = useMemo(() => {
    const year = new Date().getFullYear();
    const months = eachMonthOfInterval({
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31),
    });
    return months.map((m) => {
      const key = format(m, "yyyy-MM");
      const count = doneBooks.filter((b) => b.finished_at && b.finished_at.startsWith(key)).length;
      return { month: format(m, "M월"), count };
    });
  }, [doneBooks]);

  const maxYearlyCount = Math.max(...yearlyData.map((d) => d.count), 1);

  // --- Genre stats ---
  const genreStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of books) {
      const genre = b.genre || "미분류";
      counts[genre] = (counts[genre] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);
  }, [books]);

  const totalGenreBooks = genreStats.reduce((s, [, c]) => s + c, 0);
  const genreColors = ["#2B4C3F", "#3D6B5A", "#5A8A72", "#C4A35A", "#B86B4A", "#8B7E74"];

  // --- Segment control tabs ---
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "calendar", label: "캘린더", icon: <Calendar className="w-3.5 h-3.5" /> },
    { key: "library", label: "서재", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { key: "stats", label: "통계", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];

  const filterTabs: { key: LibraryFilter; label: string; count: number }[] = [
    { key: "all", label: "전체", count: books.length },
    { key: "want_to_read", label: "읽고 싶은", count: wantBooks.length },
    { key: "reading", label: "읽는 중", count: readingBooks.length },
    { key: "done", label: "읽은 책", count: doneBooks.length },
    { key: "abandoned", label: "중단", count: abandonedBooks.length },
  ];

  return (
    <div className="px-4 pt-6 pb-24" onClick={() => longPressId && setLongPressId(null)}>
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
        <div>
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
                const isSelected = selectedDay === key;
                const hasActivity = !!data;
                const bookCover = data?.books?.[0]?.cover_url;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(isSelected ? null : key)}
                    className={`aspect-square flex items-center justify-center rounded-md text-xs relative overflow-hidden transition-all ${
                      isToday ? "ring-1 ring-ink-green" : ""
                    } ${isSelected ? "ring-2 ring-[#C4A35A]" : ""} ${
                      hasActivity ? "bg-ink-green/10" : "bg-transparent"
                    }`}
                  >
                    {bookCover ? (
                      <img src={bookCover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 rounded-md" />
                    ) : null}
                    <span className={`relative z-10 ${hasActivity ? "font-semibold text-ink-green" : "text-warmgray"}`}>
                      {format(day, "d")}
                    </span>
                    {data && data.scrapCount > 0 && (
                      <span className="absolute bottom-0.5 right-0.5 z-10 w-1.5 h-1.5 bg-[#C4A35A] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 이달 완독 */}
            <div className="mt-3 pt-3 border-t border-[rgba(43,76,63,0.06)] flex items-center justify-between">
              <span className="text-xs text-warmgray">이번 달 완독</span>
              <span className="text-sm font-black text-ink-green">{monthlyCompleted}권</span>
            </div>
          </div>

          {/* 선택된 날짜의 스크랩 */}
          {selectedDay && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-ink-green mb-2">
                {format(parseISO(selectedDay), "M월 d일", { locale: ko })}에 그은 문장
              </p>
              {selectedDayScraps.length === 0 ? (
                <p className="text-xs text-warmgray">이 날 그은 문장이 없어요</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayScraps.map((scrap) => (
                    <div key={scrap.id} className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-3">
                      <p className="text-sm text-ink leading-relaxed" style={{ fontFamily: "serif" }}>
                        &ldquo;{scrap.text}&rdquo;
                      </p>
                      <p className="text-[10px] text-warmgray mt-1">
                        📖 {scrap.book_title || "미분류"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== LIBRARY MODE ==================== */}
      {activeTab === "library" && (
        <div>
          {/* Sub-tabs */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 border-b border-[rgba(43,76,63,0.06)] scrollbar-hide">
            {filterTabs
              .filter((ft) => ft.key === "all" || ft.count > 0)
              .map((ft) => (
              <button
                key={ft.key}
                onClick={() => setLibraryFilter(ft.key)}
                className={`shrink-0 pb-1 text-sm font-semibold transition-colors ${
                  libraryFilter === ft.key
                    ? "text-ink-green border-b-2 border-ink-green"
                    : "text-warmgray-light"
                }`}
              >
                {ft.label}
                {ft.count > 0 && (
                  <span className="text-xs font-normal ml-1 text-warmgray">({ft.count})</span>
                )}
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
              <div className="text-4xl mb-3">
                {libraryFilter === "want_to_read" ? "💛" : libraryFilter === "abandoned" ? "📕" : "📚"}
              </div>
              <p className="text-warmgray text-sm mb-4">
                {libraryFilter === "all"
                  ? "아직 등록된 책이 없어요"
                  : libraryFilter === "want_to_read"
                    ? "읽고 싶은 책이 없어요"
                    : libraryFilter === "reading"
                      ? "읽고 있는 책이 없어요"
                      : libraryFilter === "done"
                        ? "완독한 책이 없어요"
                        : "중단한 책이 없어요"}
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
                const status = resolveStatus(book);
                const isInactive = status === "abandoned" || status === "dropped";
                const isWant = status === "want_to_read";
                const progress =
                  book.current_page && book.total_pages
                    ? Math.min(
                        Math.round((book.current_page / book.total_pages) * 100),
                        100,
                      )
                    : null;
                return (
                  <div
                    key={book.id}
                    className={`relative group${isInactive && libraryFilter === "all" ? " opacity-50" : ""}`}
                    onTouchStart={() => handleLongPressStart(book.id)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                  >
                    {/* Delete X button - hover on desktop, long press on mobile */}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(book.id); setLongPressId(null); }}
                      className={`absolute -top-1.5 -right-1.5 z-10 w-6 h-6 bg-warmgray/80 text-paper rounded-full flex items-center justify-center transition-all hover:bg-red-500 active:scale-90 ${
                        longPressId === book.id ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      href={`/book/${book.id}`}
                      className={`block bg-warm rounded-card border shadow-card p-3 hover:shadow-md transition-all contain-paint ${
                        longPressId === book.id ? "border-red-300 scale-[0.97]" : "border-[rgba(43,76,63,0.08)]"
                      }`}
                      onClick={(e) => { if (longPressId === book.id) { e.preventDefault(); setLongPressId(null); } }}
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
                          backgroundColor: isWant
                            ? "rgba(196,163,90,0.12)"
                            : `${PHASES[book.phase]?.color || "#2B4C3F"}12`,
                        }}
                      >
                        <span className="text-2xl">
                          {isWant ? "💛" : PHASES[book.phase]?.icon || "📖"}
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

                    {/* Status badge */}
                    {isWant ? (
                      <span className="inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded-badge font-semibold text-[#C4A35A] bg-[#C4A35A]/15">
                        읽고 싶은
                      </span>
                    ) : isInactive ? (
                      <span className="inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded-badge font-semibold text-terra bg-terra/10">
                        중단
                      </span>
                    ) : (
                      <>
                        <span
                          className="inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded-badge font-semibold text-paper"
                          style={{
                            backgroundColor: PHASES[book.phase]?.color || "#2B4C3F",
                          }}
                        >
                          {PHASES[book.phase]?.label || "수집중"}
                        </span>
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
                      </>
                    )}

                    {/* Want memo preview */}
                    {isWant && book.want_memo && (
                      <p className="text-[9px] text-warmgray mt-1 line-clamp-1">
                        {book.want_memo}
                      </p>
                    )}
                    {isWant && book.recommended_by && (
                      <p className="text-[9px] text-warmgray/70 mt-0.5">
                        👤 {book.recommended_by}
                      </p>
                    )}
                  </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== STATS MODE ==================== */}
      {activeTab === "stats" && (
        <div className="space-y-4">
          {/* Summary cards */}
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
              <div className="text-2xl mb-1">💛</div>
              <p className="text-[11px] text-warmgray mb-0.5">읽고 싶은</p>
              <p className="text-xl font-black text-ink-green">
                {wantBooks.length}
                <span className="text-sm font-semibold ml-0.5">권</span>
              </p>
            </div>
          </div>

          {/* 월별 완독 막대 그래프 */}
          <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
            <p className="text-sm font-semibold text-ink-green mb-3">{new Date().getFullYear()}년 월별 완독</p>
            <div className="flex items-end gap-1.5 h-24">
              {yearlyData.map((d) => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-warmgray font-medium">
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${d.count > 0 ? Math.max((d.count / maxYearlyCount) * 100, 12) : 4}%`,
                      backgroundColor: d.count > 0 ? "#2B4C3F" : "rgba(43,76,63,0.08)",
                    }}
                  />
                  <span className="text-[8px] text-warmgray">{d.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 장르 분포 */}
          {genreStats.length > 0 && genreStats[0][0] !== "미분류" && (
            <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
              <p className="text-sm font-semibold text-ink-green mb-3">장르 분포</p>
              <div className="space-y-2">
                {genreStats.map(([genre, count], i) => (
                  <div key={genre} className="flex items-center gap-2">
                    <span className="text-xs text-ink w-16 truncate">{genre}</span>
                    <div className="flex-1 h-3 bg-ink-green/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(count / totalGenreBooks) * 100}%`,
                          backgroundColor: genreColors[i % genreColors.length],
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-warmgray font-medium w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-paper rounded-card shadow-lg p-6 w-full max-w-xs text-center">
            <p className="text-base font-semibold text-ink mb-2">책을 삭제할까요?</p>
            <p className="text-xs text-warmgray mb-5">
              토론 내역, 스크랩, 서평이 모두 삭제돼요.
              <br />이 작업은 되돌릴 수 없어요.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-btn border border-warmgray/30 text-warmgray text-sm font-semibold py-2.5 hover:bg-warmgray/5"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="flex-1 rounded-btn bg-red-500 text-paper text-sm font-semibold py-2.5 hover:bg-red-500/90 disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
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
