"use client";

import { useMemo } from "react";
import { Users, BookmarkPlus, CornerUpLeft } from "lucide-react";

/* ═══════════════════════════════════════════
   ReadingCalendar — 이 달의 읽기 리듬 + 이벤트
   ═══════════════════════════════════════════
   - 5주 × 7일 도트 그리드 (읽음/미읽/미래)
   - 이벤트 마커 (meeting/wish/return)
   - 하단에 D-n 이벤트 리스트
   - 모든 데이터는 props로 (dumb component)
*/

export type CalEventType = "meeting" | "wish" | "return";

export interface CalEvent {
  /** ISO date string YYYY-MM-DD */
  date: string;
  type: CalEventType;
  title: string;
  meta?: string;
  /** Book id or group id for navigation */
  targetId?: string;
}

export interface ReadingCalendarProps {
  /** Today in ISO (YYYY-MM-DD). Defaults to now. */
  today?: string;
  /** All dates user has read — ISO strings */
  readDates: string[];
  /** Upcoming events (all future, already sorted by date ascending recommended) */
  events: CalEvent[];
  /** Streak count to show in pill */
  streak: number;
  /** Tap handlers */
  onEventTap?: (event: CalEvent) => void;
  onCalendarTap?: () => void;
}

/** 월요일 시작 5주 그리드의 첫 칸(월요일) 계산.
 *  today를 포함하는 주를 중앙(3번째 주, index 14)에 두고 앞 2주·뒤 2주를 보여줌.
 */
function gridStart(today: Date): Date {
  const d = new Date(today);
  // 월=1 ~ 일=0 → 월요일로 맞춤
  const day = (d.getDay() + 6) % 7; // 월:0 화:1 ... 일:6
  d.setDate(d.getDate() - day - 14); // 2주 전 월요일
  d.setHours(0, 0, 0, 0);
  return d;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysUntil(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000
  );
}

function dayLabel(diff: number): string {
  if (diff === 0) return "D-0";
  if (diff < 0) return `지남`;
  return `D-${diff}`;
}

const EVT_COLOR: Record<CalEventType, string> = {
  meeting: "var(--ac-deep, #3A6B56)",
  wish: "#C8A030",
  return: "#C97A5B",
};

const EVT_LABEL: Record<CalEventType, string> = {
  meeting: "모임",
  wish: "시작",
  return: "반납",
};

export default function ReadingCalendar({
  today: todayProp,
  readDates,
  events,
  streak,
  onEventTap,
  onCalendarTap,
}: ReadingCalendarProps) {
  const today = todayProp ?? iso(new Date());
  const todayDate = new Date(today);

  const cells = useMemo(() => {
    const start = gridStart(todayDate);
    const readSet = new Set(readDates);
    const eventsByDate = new Map<string, CalEvent>();
    for (const e of events) eventsByDate.set(e.date, e);

    const out: {
      date: string;
      state: "read" | "miss" | "future" | "today";
      isToday: boolean;
      event?: CalEventType;
    }[] = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const di = iso(d);
      const isToday = di === today;
      let state: "read" | "miss" | "future" | "today";
      if (di > today) state = "future";
      else if (readSet.has(di)) state = "read";
      else state = "miss";
      const evt = eventsByDate.get(di);
      out.push({
        date: di,
        state,
        isToday,
        event: evt?.type,
      });
    }
    return out;
  }, [todayDate, today, readDates, events]);

  // 앞으로의 이벤트 최대 3개 (오늘 포함)
  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [events, today]);

  return (
    <div
      style={{
        margin: "16px 20px 8px",
        padding: "14px 14px 12px",
        background: "var(--sf)",
        border: "0.5px solid var(--bd)",
        borderRadius: 14,
      }}
    >
      {/* 헤더 */}
      <div
        onClick={onCalendarTap}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          cursor: onCalendarTap ? "pointer" : "default",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-playful, 'Gaegu', cursive)",
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--tp)",
          }}
        >
          이번 달 읽기 캘린더
        </div>
        {streak > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontFamily: "var(--font-playful, 'Gaegu', cursive)",
              fontSize: 11.5,
              fontWeight: 700,
              color: "var(--ac-deep, #3A6B56)",
              background: "color-mix(in srgb, var(--ac) 14%, var(--bg))",
              padding: "2px 8px",
              borderRadius: 100,
            }}
          >
            🔥 {streak}일 연속
          </span>
        )}
      </div>

      {/* 요일 헤더 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
          marginBottom: 4,
        }}
      >
        {["월", "화", "수", "목", "금", "토", "일"].map((d, i) => (
          <span
            key={d}
            style={{
              textAlign: "center",
              fontSize: 9,
              fontWeight: 700,
              color: i === 6 ? "#C97A5B" : "var(--tm)",
              letterSpacing: "0.05em",
            }}
          >
            {d}
          </span>
        ))}
      </div>

      {/* 5주 × 7일 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
          marginBottom: upcomingEvents.length ? 12 : 0,
        }}
      >
        {cells.map((cell) => {
          const dotColor =
            cell.state === "read"
              ? "var(--ac, #5FA48E)"
              : cell.state === "miss"
              ? "transparent"
              : "color-mix(in srgb, var(--tm) 12%, transparent)";
          const dotBorder =
            cell.state === "miss"
              ? "1px dashed color-mix(in srgb, var(--tm) 35%, transparent)"
              : "none";
          const outline = cell.isToday
            ? "2px solid var(--ac-deep, #3A6B56)"
            : "none";
          return (
            <div
              key={cell.date}
              aria-label={`${cell.date} ${cell.state === "read" ? "읽음" : cell.state === "miss" ? "미읽" : "예정"}`}
              style={{
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: dotColor,
                  border: dotBorder,
                  outline,
                  outlineOffset: 2,
                  boxShadow:
                    cell.state === "read"
                      ? "0 0 0 1.5px color-mix(in srgb, var(--ac) 22%, transparent)"
                      : "none",
                }}
              />
              {cell.event && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 1,
                    right: "calc(50% - 10px)",
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: EVT_COLOR[cell.event],
                    boxShadow: "0 0 0 1px var(--sf)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 이벤트 리스트 */}
      {upcomingEvents.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingTop: 10,
            borderTop: "0.5px dashed var(--bd)",
          }}
        >
          {upcomingEvents.map((e, idx) => {
            const diff = daysUntil(today, e.date);
            const urgent = e.type === "return" && diff <= 2;
            const Icon =
              e.type === "meeting"
                ? Users
                : e.type === "wish"
                ? BookmarkPlus
                : CornerUpLeft;
            return (
              <div
                key={`${e.date}-${idx}`}
                onClick={() => onEventTap?.(e)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: onEventTap ? "pointer" : "default",
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    background:
                      e.type === "meeting"
                        ? "color-mix(in srgb, var(--ac) 18%, var(--bg))"
                        : e.type === "wish"
                        ? "color-mix(in srgb, #C8A030 20%, var(--bg))"
                        : "color-mix(in srgb, #C97A5B 18%, var(--bg))",
                  }}
                  aria-label={EVT_LABEL[e.type]}
                >
                  <Icon
                    size={14}
                    strokeWidth={2}
                    color={
                      e.type === "meeting"
                        ? "var(--ac-deep, #3A6B56)"
                        : e.type === "wish"
                        ? "#8A6A20"
                        : "#8A4020"
                    }
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--tp)",
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {e.title}
                  </div>
                  {e.meta && (
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--tm)",
                        marginTop: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.meta}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-playful, 'Gaegu', cursive)",
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    padding: "2px 8px",
                    borderRadius: 100,
                    color: urgent ? "#8A4020" : "var(--tm)",
                    background: urgent
                      ? "color-mix(in srgb, #C97A5B 15%, var(--bg))"
                      : "var(--sf2)",
                  }}
                >
                  {dayLabel(diff)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
