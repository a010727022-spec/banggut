"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Flame, Check, Users, BookmarkPlus, CornerUpLeft } from "lucide-react";
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

/** Event 타입 별 아이콘/색 매핑 — Compact 버전 */
const EVT_META: Record<
  CalEventType,
  {
    iconBg: string;
    iconColor: string;
    ddayColor: string;
    ddayBg: string;
  }
> = {
  meeting: {
    iconBg: "color-mix(in srgb, var(--ac) 14%, var(--sf))",
    iconColor: "var(--ac)",
    ddayColor: "var(--ac)",
    ddayBg: "color-mix(in srgb, var(--ac) 14%, transparent)",
  },
  wish: {
    iconBg: "rgba(214,158,82,0.15)",
    iconColor: "#C8A030",
    ddayColor: "#B88A28",
    ddayBg: "rgba(214,158,82,0.15)",
  },
  return: {
    iconBg: "rgba(200,96,79,0.12)",
    iconColor: "#C8604F",
    ddayColor: "#B05545",
    ddayBg: "rgba(200,96,79,0.1)",
  },
};

/**
 * HomeCalendarWidget — 홈 전용 컴팩트 캘린더.
 *  - 오늘 기준 6일 전 ~ 오늘까지 7일 스트립
 *  - 월 헤더 + 스트릭 뱃지
 *  - 다가오는 이벤트 최대 3개 (D-day 오름차순)
 *  - 전체 카드 탭 → 기본은 /profile (이후 전체 캘린더로 연결 가능)
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

  // 이번 주 헤더용 월 표기
  const monthLabel = useMemo(() => {
    return `${today.getFullYear()}. ${today.getMonth() + 1}`;
  }, [today]);

  // 오늘 - 6일 ~ 오늘 (7일)
  const weekStrip = useMemo(() => {
    const set = new Set(readDates);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const dIso = iso(d);
      return {
        date: d,
        iso: dIso,
        label: dayLabelKo(d),
        dayNum: d.getDate(),
        isToday: dIso === todayIso,
        isRead: set.has(dIso),
      };
    });
  }, [today, todayIso, readDates]);

  // 다가오는 이벤트: 오늘 이상만, D-day 오름차순, 최대 3개
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
        border: "0.5px solid var(--bd)",
        padding: "18px 16px",
        marginBottom: 14,
        boxShadow: "0 2px 8px color-mix(in srgb, var(--tp) 3%, transparent)",
        cursor: onCardTap ? "pointer" : "default",
        transition:
          "background var(--duration-slow) var(--easing-default), border-color var(--duration-slow) var(--easing-default)",
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--tp)",
            letterSpacing: "-0.01em",
          }}
        >
          {monthLabel}
          <span
            style={{
              color: "var(--ts)",
              fontWeight: 500,
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            · 이번 주
          </span>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "var(--ac)",
            fontWeight: 700,
            background: "color-mix(in srgb, var(--ac) 12%, transparent)",
            padding: "6px 11px",
            borderRadius: 100,
          }}
        >
          <Flame size={13} strokeWidth={2} />
          <b
            style={{
              fontSize: 13,
              fontFamily: "var(--font-playful)",
              lineHeight: 1,
            }}
          >
            {streak}
          </b>
          일 연속
        </div>
      </div>

      {/* 요일 스트립 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          marginBottom: upcomingEvents.length > 0 ? 16 : 0,
        }}
      >
        {weekStrip.map((d) => {
          const isRead = d.isRead && !d.isToday;
          const isToday = d.isToday;
          const bg = isRead
            ? "var(--ac)"
            : isToday
              ? "var(--sf)"
              : "var(--sf3)";
          const fg = isRead
            ? "var(--acc)"
            : isToday
              ? "var(--ac)"
              : "var(--tm)";
          const border = isToday
            ? "2px solid var(--ac)"
            : "none";
          return (
            <div
              key={d.iso}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "2px 0",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "var(--ts)",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                {d.label}
              </span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: bg,
                  border,
                  fontSize: 11,
                  fontWeight: isToday ? 700 : 600,
                  color: fg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition:
                    "background var(--duration-fast) var(--easing-default), color var(--duration-fast) var(--easing-default)",
                }}
              >
                {isRead ? <Check size={13} strokeWidth={3} /> : d.dayNum}
              </div>
            </div>
          );
        })}
      </div>

      {/* 다가오는 이벤트 */}
      {upcomingEvents.length > 0 && (
        <div
          style={{
            borderTop: "1px dashed var(--bd2)",
            paddingTop: 14,
            display: "flex",
            flexDirection: "column",
            gap: 13,
          }}
        >
          {upcomingEvents.map((ev, i) => {
            const meta = EVT_META[ev.type];
            const diff = daysUntil(todayIso, ev.date);
            const Icon =
              ev.type === "meeting"
                ? Users
                : ev.type === "wish"
                  ? BookmarkPlus
                  : CornerUpLeft;

            // 반납일이 임박(D-3 이하)하면 warn 스타일
            const isWarn = ev.type === "return" && diff <= 3;
            const ddayBg = isWarn ? meta.ddayBg : meta.ddayBg;
            const ddayColor = isWarn ? meta.ddayColor : meta.ddayColor;

            return (
              <div
                key={`${ev.date}-${i}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEvTap(ev);
                }}
                role={ev.targetId || onEventTap ? "button" : undefined}
                tabIndex={ev.targetId || onEventTap ? 0 : undefined}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && (ev.targetId || onEventTap)) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEvTap(ev);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  cursor: ev.targetId || onEventTap ? "pointer" : "default",
                  minHeight: 44,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    minWidth: 36,
                    borderRadius: 11,
                    background: meta.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: meta.iconColor,
                  }}
                >
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--tp)",
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
                      }}
                    >
                      {ev.meta}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: ddayColor,
                    background: ddayBg,
                    padding: "4px 9px",
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                >
                  {diff === 0 ? "오늘" : `D-${diff}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
