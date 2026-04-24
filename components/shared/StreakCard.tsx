"use client";

import { useMemo } from "react";
import { Flame, ChevronRight, Check } from "lucide-react";
import type { CalEvent } from "./ReadingCalendar";

/* ═══════════════════════════════════════════
   StreakCard — v6: 책갈피 카드
   ═══════════════════════════════════════════
   - 메타포: 책 뒤에 꽂는 도서관 대출카드 + 책갈피
   - 크림 페이퍼 서피스 · 왼쪽 민트 책갈피 리본 4px
   - 우상단 도서관 스탬프 라벨 (monospace)
   - 작고 정제된 타이포 · 구리빛 flame
   - 민트는 악센트 (리본/dot/핀)로만 사용
   - 높이 ~72px (기존 대비 35% 슬림)
*/

// ────────── Palette (책장 무드) ──────────
const MINT = "#5FA48E";          // var(--ac)
const MINT_DEEP = "#3A6B56";
const COPPER = "#B5802A";        // 구리빛 flame
const COPPER_SOFT = "#E8C97A";
const COPPER_DEEP = "#7A4E22";
const CORAL = "#C97A5B";
const CORAL_DEEP = "#8E3E22";
const PAPER_GRAIN = "rgba(165,130,75,0.025)";

// ────────── Utils ──────────
function calcDaysTogether(streakDates: string[]): number {
  if (streakDates.length === 0) return 0;
  const sorted = [...streakDates].sort();
  const first = new Date(sorted[0]);
  const today = new Date();
  return Math.floor((today.getTime() - first.getTime()) / 86400000) + 1;
}

function daysUntil(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000
  );
}

function dayLabel(diff: number): string {
  if (diff === 0) return "D-0";
  if (diff < 0) return "지남";
  return `D-${diff}`;
}

function eventShortTitle(e: CalEvent): string {
  if (e.type === "meeting") return "모임 · " + trimTitle(e.title, 10);
  if (e.type === "wish") return "시작 · " + trimTitle(e.title, 10);
  if (e.type === "return") return "반납 · " + trimTitle(e.title, 10);
  return trimTitle(e.title, 14);
}

function trimTitle(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function weeklyPattern(streakDates: string[], todayIso: string): boolean[] {
  const todayDate = new Date(todayIso + "T00:00:00");
  const day = todayDate.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - mondayOffset);
  const set = new Set(streakDates);
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return set.has(d.toISOString().slice(0, 10));
  });
}

function todayWeekIndex(todayIso: string): number {
  const day = new Date(todayIso + "T00:00:00").getDay();
  return day === 0 ? 6 : day - 1;
}

// ────────── Props ──────────
export interface StreakCardProps {
  streak: number;
  streakDates: string[];
  events?: CalEvent[];
  today?: string;
  onTap?: () => void;
}

export default function StreakCard({
  streak,
  streakDates,
  events = [],
  today: todayProp,
  onTap,
}: StreakCardProps) {
  const today = todayProp ?? new Date().toISOString().slice(0, 10);

  const daysTogether = useMemo(() => calcDaysTogether(streakDates), [streakDates]);
  const weekPattern = useMemo(
    () => weeklyPattern(streakDates, today),
    [streakDates, today]
  );
  const weekCount = useMemo(() => weekPattern.filter(Boolean).length, [weekPattern]);
  const todayIdx = useMemo(() => todayWeekIndex(today), [today]);
  const readToday = streakDates.includes(today);

  const nextEvent = useMemo(() => {
    const upcoming = events
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcoming[0] ?? null;
  }, [events, today]);

  const nextDiff = nextEvent ? daysUntil(today, nextEvent.date) : null;
  const urgent =
    nextEvent?.type === "return" && nextDiff !== null && nextDiff <= 2;

  const hasStreak = streak > 0;

  // 서브 카피 (짧게 — 같은 줄에 들어감)
  const subLabel = daysTogether > 0 ? `${daysTogether}일째` : "오늘 시작해요";

  return (
    <button
      onClick={onTap}
      aria-label="읽기 캘린더 열기"
      style={{
        position: "relative",
        display: "block",
        width: "calc(100% - 40px)",
        margin: "14px 20px 4px",
        padding: "10px 12px 11px 16px",
        background: "var(--sf)",
        border: "0.5px solid var(--bd)",
        borderRadius: 10,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.85), " +
          "0 1px 2px rgba(50,40,25,0.035), " +
          "0 6px 14px rgba(50,40,25,0.04)",
        cursor: onTap ? "pointer" : "default",
        transition: "transform 0.16s ease, box-shadow 0.16s ease",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow =
          "inset 0 1px 0 rgba(255,255,255,0.85), " +
          "0 2px 4px rgba(50,40,25,0.05), " +
          "0 10px 22px rgba(50,40,25,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow =
          "inset 0 1px 0 rgba(255,255,255,0.85), " +
          "0 1px 2px rgba(50,40,25,0.035), " +
          "0 6px 14px rgba(50,40,25,0.04)";
      }}
    >
      {/* ━━━ 종이 그레인 (수평선 아주 희미하게) ━━━ */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0, transparent 13px, ${PAPER_GRAIN} 13px, ${PAPER_GRAIN} 14px)`,
          pointerEvents: "none",
          borderRadius: "inherit",
        }}
      />

      {/* ━━━ 왼쪽 책갈피 리본 ━━━ */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 6,
          bottom: 6,
          left: 0,
          width: 4,
          borderRadius: "0 2px 2px 0",
          background: hasStreak
            ? `linear-gradient(180deg, ${MINT} 0%, ${MINT_DEEP} 100%)`
            : "color-mix(in srgb, var(--tm) 18%, transparent)",
          boxShadow: hasStreak
            ? `1px 0 3px color-mix(in srgb, ${MINT} 35%, transparent)`
            : "none",
        }}
      />

      {/* ━━━ 우상단 도서관 스탬프 라벨 ━━━ */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 11,
          right: 14,
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 8,
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: readToday
            ? MINT_DEEP
            : "color-mix(in srgb, var(--tm) 55%, transparent)",
        }}
      >
        {readToday && (
          <Check size={9} strokeWidth={3} color={MINT_DEEP} />
        )}
        {readToday ? "오늘 기록" : "day " + streak}
      </span>

      {/* ━━━ 본문 ━━━ */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Row 1 — flame + streak hero */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 7,
            minWidth: 0,
          }}
        >
          <Flame
            size={15}
            color={hasStreak ? COPPER : "color-mix(in srgb, var(--tm) 55%, transparent)"}
            fill={hasStreak ? COPPER_SOFT : "transparent"}
            strokeWidth={2.1}
            style={{
              alignSelf: "flex-end",
              marginBottom: 4,
              filter: hasStreak
                ? `drop-shadow(0 1px 2px color-mix(in srgb, ${COPPER} 30%, transparent))`
                : "none",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-playful)",
              fontSize: 30,
              fontWeight: 700,
              color: "var(--tp)",
              lineHeight: 0.9,
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {streak}
          </span>
          <span
            style={{
              fontFamily: "var(--font-playful)",
              fontSize: 13,
              color: "var(--ts)",
              fontWeight: 700,
              letterSpacing: "var(--ls-gaegu, 0.02em)",
              alignSelf: "flex-end",
              marginBottom: 2,
            }}
          >
            일 연속
          </span>
          <span
            style={{
              fontSize: 10.5,
              color: "var(--tm)",
              fontWeight: 600,
              alignSelf: "flex-end",
              marginBottom: 3,
              marginLeft: 1,
            }}
          >
            · {subLabel}
          </span>
        </div>

        {/* Row 2 — weekly dots · count · next event · chevron */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            overflow: "hidden",
          }}
        >
          {/* 주간 dots */}
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            {weekPattern.map((on, i) => {
              const isToday = i === todayIdx;
              return (
                <span
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: on
                      ? MINT
                      : "color-mix(in srgb, var(--tm) 22%, transparent)",
                    outline: isToday ? `1px solid ${COPPER}` : "none",
                    outlineOffset: isToday ? 1.25 : 0,
                    display: "inline-block",
                    boxShadow: on
                      ? `0 0.5px 1px color-mix(in srgb, ${MINT_DEEP} 25%, transparent)`
                      : "none",
                  }}
                />
              );
            })}
          </div>
          {/* N/7 */}
          <span
            style={{
              fontSize: 10,
              color: "var(--tm)",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-playful)",
                fontSize: 12,
                color: MINT_DEEP,
                fontWeight: 700,
              }}
            >
              {weekCount}
            </span>
            <span style={{ opacity: 0.55 }}>/7</span>
          </span>

          {/* dot sep */}
          <span
            aria-hidden
            style={{
              width: 2,
              height: 2,
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--tm) 40%, transparent)",
              flexShrink: 0,
            }}
          />

          {/* next event */}
          {nextEvent ? (
            <>
              <span
                style={{
                  color: "var(--ts)",
                  fontSize: 11,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                  flex: 1,
                  fontWeight: 500,
                }}
              >
                {eventShortTitle(nextEvent)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-playful)",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1.5px 7px",
                  borderRadius: 100,
                  background: urgent
                    ? `color-mix(in srgb, ${CORAL} 13%, var(--bg))`
                    : `color-mix(in srgb, ${MINT} 13%, var(--bg))`,
                  color: urgent ? CORAL_DEEP : MINT_DEEP,
                  border: `0.5px solid ${
                    urgent
                      ? `color-mix(in srgb, ${CORAL} 35%, transparent)`
                      : `color-mix(in srgb, ${MINT} 30%, transparent)`
                  }`,
                  flexShrink: 0,
                  letterSpacing: "var(--ls-gaegu, 0.01em)",
                }}
              >
                {dayLabel(nextDiff ?? 0)}
              </span>
            </>
          ) : (
            <span
              style={{
                color: "var(--tm)",
                fontSize: 10.5,
                fontStyle: "italic",
                flex: 1,
                fontWeight: 500,
              }}
            >
              다음 일정을 기다려요
            </span>
          )}

          <ChevronRight
            size={13}
            strokeWidth={2}
            color="color-mix(in srgb, var(--tm) 70%, transparent)"
            style={{ flexShrink: 0 }}
          />
        </div>
      </div>
    </button>
  );
}
