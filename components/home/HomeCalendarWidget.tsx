"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { CalEvent, CalEventType } from "@/components/shared/ReadingCalendar";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysUntil(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000
  );
}

function dayLabelKo(d: Date): string {
  return ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 이벤트 타입별 색 토큰 — sage / rose / copper. */
const EVT_THEME: Record<
  CalEventType,
  {
    pillBg: string;
    pillFg: string;
    mmFg: string;
    tagFg: string;
    tagLabel: string;
  }
> = {
  meeting: {
    pillBg: "color-mix(in srgb, var(--ac) 14%, transparent)",
    pillFg: "var(--ac-deep)",
    mmFg: "var(--ac-deep)",
    tagFg: "var(--ac-deep)",
    tagLabel: "모임 일정",
  },
  wish: {
    pillBg: "rgba(217, 156, 171, 0.18)",
    pillFg: "#A8506B",
    mmFg: "#A8506B",
    tagFg: "#A8506B",
    tagLabel: "위시 책 시작",
  },
  return: {
    pillBg: "color-mix(in srgb, var(--milestone) 20%, transparent)",
    pillFg: "#8C6A2E",
    mmFg: "#8C6A2E",
    tagFg: "#8C6A2E",
    tagLabel: "도서관 반납",
  },
};

function buildPill(diff: number, dateIso: string, eventTime?: string): { mm: string; dd: string } {
  const d = new Date(dateIso);
  const ddDate = `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  if (diff === 0) {
    return { mm: "오늘", dd: eventTime ?? ddDate };
  }
  if (diff === 1) {
    return { mm: "내일", dd: ddDate };
  }
  return { mm: `${diff}일 후`, dd: ddDate };
}

/** 시각 추출: meta 가 "19:00 ..." 같은 형태면 앞쪽 시각만 뽑는다. */
function extractTime(meta?: string): string | undefined {
  if (!meta) return undefined;
  const m = meta.match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : undefined;
}

/**
 * HomeCalendarWidget — mockup-home-v2.html Phone A 캘린더 위젯.
 *  - 헤더: serif 오늘 날짜 + sage-bg 스트릭 칩 (🫘 N일째)
 *  - 7일 strip: 26px 점, sage-fill(완료) / sage-ring(오늘) / dashed(미래)
 *  - 이벤트 리스트: 날짜 필 + 태그 라벨 + 제목/메타 (sage / rose / copper)
 */
export default function HomeCalendarWidget({
  readDates,
  events,
  streak,
  onCardTap,
  onEventTap,
}: {
  readDates: string[];
  events: CalEvent[];
  streak: number;
  onCardTap?: () => void;
  onEventTap?: (event: CalEvent) => void;
}) {
  const router = useRouter();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayIso = useMemo(() => iso(today), [today]);

  const todayLabel = useMemo(() => {
    return `${today.getMonth() + 1}월 ${today.getDate()}일 ${dayLabelKo(today)}`;
  }, [today]);

  // 오늘 기준 월~일 7일 strip (월요일 시작)
  const weekStrip = useMemo(() => {
    const set = new Set(readDates);
    const monday = new Date(today);
    const dow = today.getDay();
    const offsetToMon = dow === 0 ? -6 : 1 - dow;
    monday.setDate(monday.getDate() + offsetToMon);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const dIso = iso(d);
      const isToday = dIso === todayIso;
      const isFuture = dIso > todayIso;
      return {
        iso: dIso,
        label: dayLabelKo(d),
        dayNum: d.getDate(),
        isToday,
        isFuture,
        isDone: !isFuture && !isToday && set.has(dIso),
      };
    });
  }, [today, todayIso, readDates]);

  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => e.date >= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [events, todayIso]);

  const handleCardTap = () => {
    if (onCardTap) onCardTap();
  };

  const handleEvTap = (event: CalEvent) => {
    if (onEventTap) {
      onEventTap(event);
    } else if (event.targetId) {
      router.push(`/book/${event.targetId}`);
    }
  };

  return (
    <div
      onClick={handleCardTap}
      role={onCardTap ? "button" : undefined}
      tabIndex={onCardTap ? 0 : undefined}
      onKeyDown={(e) => {
        if (onCardTap && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleCardTap();
        }
      }}
      style={{
        background: "var(--sf)",
        borderRadius: 18,
        border: "1.5px solid var(--tp)",
        padding: 14,
        marginBottom: 14,
        boxShadow:
          "0 1px 0 color-mix(in srgb, var(--tp) 4%, transparent), 2px 4px 0 color-mix(in srgb, var(--tp) 8%, transparent)",
        cursor: onCardTap ? "pointer" : "default",
        transition:
          "background var(--duration-slow) var(--easing-default), border-color var(--duration-slow) var(--easing-default)",
      }}
    >
      {/* 헤더: serif 오늘 날짜 + 스트릭 칩 + chevron */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontFamily: "Fraunces, 'Times New Roman', serif",
            fontSize: 19,
            fontWeight: 700,
            color: "var(--tp)",
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}
        >
          {todayLabel}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--ac-deep)",
            fontWeight: 700,
            background: "color-mix(in srgb, var(--ac) 14%, transparent)",
            padding: "2px 8px",
            borderRadius: 100,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          🫘
          <span style={{ fontFamily: "var(--font-playful)", fontSize: 13, lineHeight: 1 }}>
            {streak}
          </span>
          일째
        </div>
        <ChevronRight
          size={18}
          strokeWidth={2}
          style={{
            marginLeft: "auto",
            color: "var(--ts)",
            flexShrink: 0,
          }}
        />
      </div>

      {/* 7일 strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          padding: "8px 4px 4px",
        }}
      >
        {weekStrip.map((d) => {
          const baseDot = {
            width: 26,
            height: 26,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600 as const,
            transition:
              "background var(--duration-fast) var(--easing-default), color var(--duration-fast) var(--easing-default)",
          };
          let dotStyle: React.CSSProperties = {
            ...baseDot,
            background: "var(--sf2)",
            color: "var(--ts)",
            border: "1.5px solid transparent",
          };
          if (d.isDone) {
            dotStyle = {
              ...baseDot,
              background: "var(--ac)",
              color: "var(--acc)",
              fontWeight: 700,
              border: "1.5px solid transparent",
            };
          } else if (d.isToday) {
            dotStyle = {
              ...baseDot,
              background: "var(--sf)",
              color: "var(--ac-deep)",
              fontWeight: 800,
              border: "1.5px solid var(--ac-deep)",
              boxShadow: "0 0 0 3px color-mix(in srgb, var(--ac) 25%, transparent)",
            };
          } else if (d.isFuture) {
            dotStyle = {
              ...baseDot,
              background: "var(--sf)",
              color: "var(--tm)",
              border: "1.5px dashed var(--bd2)",
            };
          }
          return (
            <div
              key={d.iso}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-playful)",
                  fontSize: 11,
                  color: "var(--ts)",
                }}
              >
                {d.label}
              </span>
              <div style={dotStyle}>{d.dayNum}</div>
            </div>
          );
        })}
      </div>

      {/* divider + event list */}
      {upcomingEvents.length > 0 && (
        <>
          <div
            style={{
              height: 1,
              background: "var(--bd)",
              margin: "10px 0 10px",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingEvents.map((ev, i) => {
              const theme = EVT_THEME[ev.type];
              const diff = daysUntil(todayIso, ev.date);
              const time = extractTime(ev.meta);
              const pill = buildPill(diff, ev.date, time);
              const interactive = Boolean(ev.targetId || onEventTap);
              return (
                <div
                  key={`${ev.date}-${i}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEvTap(ev);
                  }}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (interactive && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEvTap(ev);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "var(--bg)",
                    borderRadius: 12,
                    border: "1px solid var(--bd)",
                    cursor: interactive ? "pointer" : "default",
                    minHeight: 44,
                  }}
                >
                  {/* 날짜 필 */}
                  <div
                    style={{
                      minWidth: 50,
                      textAlign: "center",
                      padding: "4px 6px",
                      borderRadius: 8,
                      background: theme.pillBg,
                      color: theme.pillFg,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        color: theme.mmFg,
                      }}
                    >
                      {pill.mm}
                    </div>
                    <div
                      style={{
                        fontFamily: "Fraunces, 'Times New Roman', serif",
                        fontSize: 16,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        marginTop: -1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {pill.dd}
                    </div>
                  </div>
                  {/* info: 태그 + 제목 + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-playful)",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        color: theme.tagFg,
                        marginBottom: 1,
                      }}
                    >
                      {theme.tagLabel}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--tp)",
                        lineHeight: 1.3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {ev.title}
                    </div>
                    {ev.meta && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--ts)",
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ev.meta}
                      </div>
                    )}
                  </div>
                  <ChevronRight
                    size={18}
                    strokeWidth={2}
                    style={{ color: "var(--ts)", flexShrink: 0 }}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
