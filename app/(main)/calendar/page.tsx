"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { getBooks, getAllStreakDates } from "@/lib/supabase/queries";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { Book } from "@/lib/types";

/* 스트릭 계산 */
function calcStreak(dates: string[]): number {
  const set = new Set(dates);
  let s = 0;
  const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) {
    s++;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

type DayEvent = {
  type: "meet" | "plan" | "due";
  bookId?: string;
  title: string;
  sub?: string;
};

export default function CalendarPage() {
  useThemeStore();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { books, setBooks } = useLibraryStore();
  const [streakDates, setStreakDates] = useState<string[]>([]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const sb = createClient();
    Promise.all([
      getBooks(sb, user.id).then(setBooks),
      getAllStreakDates(sb, user.id).then(setStreakDates),
    ]).finally(() => setLoading(false));
  }, [user, setBooks]);

  const cursorDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const todayIso = new Date().toISOString().slice(0, 10);
  const streakSet = useMemo(() => new Set(streakDates), [streakDates]);
  const streak = calcStreak(streakDates);

  // 이 달 이벤트 수집 (계획 시작일, 반납일)
  const events = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    books.forEach((b: Book) => {
      if (b.plan_to_start_at) {
        const iso = b.plan_to_start_at;
        const arr = map.get(iso) || [];
        arr.push({ type: "plan", bookId: b.id, title: b.title, sub: `내일부터 읽기로` });
        map.set(iso, arr);
      }
    });
    return map;
  }, [books]);

  // 이번 달 통계
  const monthStats = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    const readDays = streakDates.filter((d) => d.startsWith(prefix)).length;
    const finishedThis = books.filter(
      (b) => b.reading_status === "finished" && b.finished_at?.startsWith(prefix),
    );
    return {
      readDays,
      finishedCount: finishedThis.length,
      finishedBooks: finishedThis,
    };
  }, [streakDates, books, year, month]);

  // 다가오는 일정 (오늘부터 7일 이내)
  const upcoming = useMemo(() => {
    const list: Array<{ date: string; event: DayEvent }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7days = new Date(today);
    in7days.setDate(in7days.getDate() + 7);

    books.forEach((b) => {
      // 계획일
      if (b.plan_to_start_at) {
        const d = new Date(b.plan_to_start_at);
        if (d >= today && d <= in7days) {
          list.push({ date: b.plan_to_start_at, event: { type: "plan", bookId: b.id, title: b.title, sub: "읽기 시작 예정" } });
        }
      }
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [books]);

  // 캘린더 그리드 생성
  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDow = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const prevMonthLast = new Date(year, month, 0).getDate();

    const cells: { date: Date; iso: string; isCurrent: boolean }[] = [];
    // 이전 달 채우기
    for (let i = firstDow - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast - i);
      cells.push({ date: d, iso: d.toISOString().slice(0, 10), isCurrent: false });
    }
    // 이번 달
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      cells.push({ date: d, iso: d.toISOString().slice(0, 10), isCurrent: true });
    }
    // 다음 달 채우기 (6행)
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, iso: d.toISOString().slice(0, 10), isCurrent: false });
    }
    return cells;
  }, [year, month]);

  const monthLabel = `${month + 1}월`;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tm)", fontSize: 13 }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 100, transition: "background 0.4s" }}>
      {/* 헤더 */}
      <div style={{ padding: "52px 20px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--sf)", border: "0.5px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <ArrowLeft size={16} color="var(--ts)" strokeWidth={2} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Gaegu', cursive", fontSize: 18, fontWeight: 700, color: "var(--tp)", letterSpacing: "0.02em", lineHeight: 1.2 }}>
            나의 <span style={{ color: "var(--ac)" }}>독서 달력</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 2 }}>
            {year}년 {monthLabel} · {monthStats.readDays}일 읽음
          </div>
        </div>
      </div>

      {/* 캘린더 카드 */}
      <div
        style={{
          margin: "0 20px 18px",
          padding: 20,
          background: "linear-gradient(135deg, color-mix(in srgb, var(--ac) 10%, var(--sf)), var(--sf))",
          border: "0.5px solid var(--bd)",
          borderRadius: 22,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            background: "radial-gradient(circle, color-mix(in srgb, var(--ac) 20%, transparent), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* 월 네비 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, position: "relative", zIndex: 2 }}>
          <div>
            <div style={{ fontFamily: "'Gaegu', cursive", fontSize: 26, fontWeight: 700, color: "var(--tp)", letterSpacing: "0.02em", lineHeight: 1 }}>
              {monthLabel}
            </div>
            <div style={{ fontSize: 11, color: "var(--tm)", fontWeight: 600, marginTop: 3 }}>{year}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setMonthOffset((m) => m - 1)}
              style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg)", border: "0.5px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ts)", cursor: "pointer" }}
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setMonthOffset((m) => m + 1)}
              style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg)", border: "0.5px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ts)", cursor: "pointer" }}
            >
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* 요일 + 그리드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 12, position: "relative", zIndex: 2 }}>
          {["일", "월", "화", "수", "목", "금", "토"].map((dow, i) => (
            <div
              key={dow}
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: i === 0 ? "var(--rose, #E09B8E)" : "var(--tm)",
                textAlign: "center",
                padding: "3px 0",
                letterSpacing: "0.3px",
              }}
            >
              {dow}
            </div>
          ))}
          {days.map((cell, i) => {
            const isRead = streakSet.has(cell.iso);
            const isToday = cell.iso === todayIso;
            const dayEvents = events.get(cell.iso) || [];
            const isSunday = cell.date.getDay() === 0 && cell.isCurrent;

            return (
              <div
                key={i}
                style={{
                  aspectRatio: "1/1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: isToday ? 800 : 600,
                  color: !cell.isCurrent
                    ? "var(--tf, rgba(28,32,29,0.35))"
                    : isRead
                    ? "var(--acc)"
                    : isSunday
                    ? "var(--rose, #E09B8E)"
                    : "var(--ts)",
                  background: isRead
                    ? "linear-gradient(135deg, var(--ac), var(--ac2))"
                    : "transparent",
                  borderRadius: 9,
                  outline: isToday ? "1.5px solid var(--ac)" : "none",
                  outlineOffset: -1.5,
                  position: "relative",
                  cursor: "pointer",
                  boxShadow: isRead ? "0 2px 8px color-mix(in srgb, var(--ac) 25%, transparent)" : "none",
                }}
              >
                {cell.date.getDate()}
                {dayEvents.length > 0 && (
                  <div style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2 }}>
                    {dayEvents.slice(0, 3).map((ev, ei) => (
                      <div
                        key={ei}
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: "50%",
                          background: ev.type === "meet" ? "var(--sky, #8BA4C0)" : ev.type === "plan" ? "var(--milestone, #B79556)" : "var(--rose, #E09B8E)",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 월간 통계 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, position: "relative", zIndex: 2 }}>
          <div style={{ background: "var(--bg)", border: "0.5px solid var(--bd)", borderRadius: 12, padding: 10, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.3px", lineHeight: 1 }}>{monthStats.readDays}</div>
            <div style={{ fontSize: 9, color: "var(--tm)", fontWeight: 700, marginTop: 4, letterSpacing: "0.3px" }}>읽은 날</div>
          </div>
          <div style={{ background: "var(--bg)", border: "0.5px solid var(--bd)", borderRadius: 12, padding: 10, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.3px", lineHeight: 1 }}>{streak}</div>
            <div style={{ fontSize: 9, color: "var(--tm)", fontWeight: 700, marginTop: 4, letterSpacing: "0.3px" }}>연속</div>
          </div>
          <div style={{ background: "var(--bg)", border: "0.5px solid var(--bd)", borderRadius: 12, padding: 10, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.3px", lineHeight: 1 }}>{monthStats.finishedCount}</div>
            <div style={{ fontSize: 9, color: "var(--tm)", fontWeight: 700, marginTop: 4, letterSpacing: "0.3px" }}>완독</div>
          </div>
        </div>

        {/* 범례 */}
        <div style={{ display: "flex", gap: 10, paddingTop: 12, marginTop: 12, borderTop: "0.5px solid var(--bd)", position: "relative", zIndex: 2, flexWrap: "wrap" }}>
          {[
            { label: "독서", color: "linear-gradient(135deg, var(--ac), var(--ac2))" },
            { label: "시작 예정", color: "var(--milestone, #B79556)" },
            { label: "모임", color: "var(--sky, #8BA4C0)" },
            { label: "반납일", color: "var(--rose, #E09B8E)" },
          ].map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: "var(--ts)" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* 다가오는 일정 */}
      {upcoming.length > 0 && (
        <>
          <div style={{ padding: "4px 20px 10px", fontFamily: "'Gaegu', cursive", fontSize: 14, fontWeight: 700, color: "var(--tp)", letterSpacing: "0.02em" }}>
            📆 이번 주 일정
          </div>
          {upcoming.map((u, i) => {
            const d = new Date(u.date);
            return (
              <div
                key={i}
                onClick={() => u.event.bookId && router.push(`/book/${u.event.bookId}`)}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 14px",
                  margin: "0 20px 8px",
                  background: "var(--sf)",
                  border: "0.5px solid var(--bd)",
                  borderRadius: 14,
                  alignItems: "center",
                  cursor: u.event.bookId ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "var(--bg)", border: "0.5px solid var(--bd)", flexShrink: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--tm)", lineHeight: 1 }}>{d.getMonth() + 1}월</div>
                  <div style={{ fontFamily: "'Gaegu', cursive", fontSize: 18, fontWeight: 700, color: "var(--tp)", lineHeight: 1, marginTop: 2 }}>{d.getDate()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: u.event.type === "plan" ? "var(--milestone, #B79556)" : u.event.type === "meet" ? "var(--sky, #8BA4C0)" : "var(--rose, #E09B8E)", letterSpacing: "0.4px", marginBottom: 2 }}>
                    {u.event.type === "plan" ? "📅 시작 예정" : u.event.type === "meet" ? "💬 모임" : "🏛 반납일"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)", lineHeight: 1.3, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.event.title}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--tm)" }}>{u.event.sub}</div>
                </div>
                <div style={{ color: "var(--tf, rgba(28,32,29,0.35))", fontSize: 14, flexShrink: 0 }}>→</div>
              </div>
            );
          })}
        </>
      )}

      {/* 이번 달 완독 */}
      {monthStats.finishedBooks.length > 0 && (
        <>
          <div style={{ padding: "14px 20px 10px", fontFamily: "'Gaegu', cursive", fontSize: 14, fontWeight: 700, color: "var(--tp)", letterSpacing: "0.02em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🏆 이번 달 완독</span>
            <span style={{ fontSize: 11, color: "var(--tm)", fontWeight: 500 }}>{monthStats.finishedCount}권</span>
          </div>
          <div style={{ display: "flex", gap: 10, padding: "0 20px 16px", overflowX: "auto", scrollbarWidth: "none" as const }}>
            {monthStats.finishedBooks.map((b) => (
              <div
                key={b.id}
                onClick={() => router.push(`/book/${b.id}`)}
                style={{ flexShrink: 0, width: 112, cursor: "pointer" }}
              >
                <div style={{ width: "100%", aspectRatio: "7/10", borderRadius: 8, overflow: "hidden", marginBottom: 6, background: "linear-gradient(135deg, #3a2a1a, #8a6030)", color: "#f4efe8", display: "flex", alignItems: "flex-end", padding: 6, fontSize: 10, fontWeight: 700, lineHeight: 1.2, boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
                  {b.cover_url ? (
                    <img src={b.cover_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    b.title
                  )}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tp)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</div>
                <div style={{ fontSize: 9.5, color: "var(--tm)", marginTop: 2 }}>
                  {b.rating ? `★ ${b.rating.toFixed(1)}` : b.finished_at?.slice(5, 10) || ""}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
