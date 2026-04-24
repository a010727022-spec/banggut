"use client";

import { useMemo } from "react";

/**
 * BookFocusCalendar — 이 책을 이번 주 어떤 요일에 읽었는지 보여주는 7일 스트립.
 *
 * 디자인 (v6 refined):
 * - 월~일 7칸 균등 그리드
 * - 읽은 날: mascot-happy.png 14px 도장 (기울기 6deg, opacity 0.85)
 * - 오늘 칸: `var(--ac)` 10% 배경 + 활성 컬러 날짜
 * - `todayFresh`가 true: 오늘 도장이 22px + stamp 키프레임 (방금 완료한 순간)
 *
 * @param readDates   이번 주 중 읽은 날의 ISO 문자열 집합 (YYYY-MM-DD)
 * @param todayFresh  오늘 이제 막 완료했는지 (Phone C 상태)
 * @param weekCount   이번 주 읽은 총 일수 (헤더 숫자용)
 */

interface BookFocusCalendarProps {
  readDates: Set<string>;
  todayFresh?: boolean;
  weekCount: number;
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildWeek(now: Date = new Date()) {
  // ISO 주 (월요일 시작)
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const dow = start.getDay(); // 0 = Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  start.setDate(start.getDate() + mondayOffset);

  const todayIso = toISODate(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = toISODate(d);
    return {
      label: WEEKDAY_LABELS[i],
      day: d.getDate(),
      iso,
      isToday: iso === todayIso,
    };
  });
}

export default function BookFocusCalendar({
  readDates,
  todayFresh = false,
  weekCount,
}: BookFocusCalendarProps) {
  const days = useMemo(() => buildWeek(), []);

  return (
    <>
      <style>{`
        @keyframes fs-cal-stamp {
          0%   { transform: translate(-50%, -50%) rotate(45deg)  scale(0);    opacity: 0; }
          55%  { transform: translate(-50%, -50%) rotate(-14deg) scale(1.35); opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(-8deg)  scale(1);    opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fs-cal-stamp-fresh { animation: none !important; }
        }
      `}</style>

      <div
        style={{
          background: "var(--sf)",
          border: "0.5px solid var(--bd)",
          borderRadius: 14,
          padding: "14px 12px 12px",
          margin: "0 2px",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "0 4px 10px",
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--tp)",
              letterSpacing: "-0.005em",
            }}
          >
            이번 주 독서
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--tm)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <b
              style={{
                color: "var(--ac)",
                fontWeight: 700,
                fontFamily: "'Fraunces', serif",
              }}
            >
              {weekCount}
            </b>
            일 / 7일
          </span>
        </div>

        {/* 7일 그리드 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
          }}
        >
          {days.map((d) => {
            const isRead = readDates.has(d.iso);
            const showFreshStamp = d.isToday && todayFresh;
            const showRegularStamp = isRead && !showFreshStamp;
            const hasAnyStamp = showFreshStamp || showRegularStamp;

            return (
              <div
                key={d.iso}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 2px 8px",
                  borderRadius: 10,
                  background: d.isToday
                    ? "color-mix(in srgb, var(--ac) 10%, var(--sf))"
                    : "transparent",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--tm)",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                  }}
                >
                  {d.label}
                </span>
                <span
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 14,
                    fontWeight: d.isToday ? 700 : 600,
                    color: d.isToday
                      ? "var(--ac)"
                      : isRead
                        ? "var(--tp)"
                        : "var(--ts)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {d.day}
                </span>
                <div
                  style={{
                    position: "relative",
                    width: 8,
                    height: 8,
                    marginTop: 2,
                  }}
                >
                  {hasAnyStamp ? (
                    <span
                      className={showFreshStamp ? "fs-cal-stamp-fresh" : ""}
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: showFreshStamp ? 22 : 14,
                        height: showFreshStamp ? 22 : 14,
                        transform: `translate(-50%, -50%) rotate(${
                          showFreshStamp ? -8 : 6
                        }deg)`,
                        backgroundImage: "url('/mascot-happy.png')",
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        filter: "drop-shadow(1px 2px 0 rgba(43,36,32,.18))",
                        animation: showFreshStamp
                          ? "fs-cal-stamp 1.2s cubic-bezier(.3,1.5,.4,1) 0.2s both"
                          : undefined,
                        opacity: showRegularStamp ? 0.85 : 1,
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--bd)",
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
