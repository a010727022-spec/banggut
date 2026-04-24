"use client";

import { useRouter } from "next/navigation";
import { calcStreak } from "@/lib/reading-utils";

type Variant = "today_goal" | "yearly_ring";

interface Props {
  variant?: Variant | null;
  /** 독서 연속 일수 계산용 */
  streakDates: string[];
  /** 올해 완독 권수 */
  finishedThisYear: number;
  /** 연간 목표 (없으면 `null`) */
  yearlyGoal?: number | null;
  /** 오늘 읽은 페이지 */
  pagesReadToday?: number;
  /** 하루 목표 페이지 (없으면 기본 30) */
  dailyPageGoal?: number | null;
}

/**
 * 홈/헤더용 독서 통계 위젯.
 * 두 가지 레이아웃:
 *  - today_goal: 오늘 목표 진행바 + 스트릭 + 연간 푸터 (기본)
 *  - yearly_ring: 연간 도넛 링 + 스트릭/오늘 사이드
 */
export default function StatsWidget({
  variant = "today_goal",
  streakDates,
  finishedThisYear,
  yearlyGoal,
  pagesReadToday = 0,
  dailyPageGoal,
}: Props) {
  const router = useRouter();
  const streak = calcStreak(streakDates);
  const pageGoal = dailyPageGoal || 30;
  const progressPct = Math.min(100, Math.round((pagesReadToday / pageGoal) * 100));
  const year = new Date().getFullYear();

  if (variant === "yearly_ring") {
    const yGoal = yearlyGoal || 24;
    const yearPct = Math.min(100, Math.round((finishedThisYear / yGoal) * 100));
    const circumference = 2 * Math.PI * 32;
    const dash = (yearPct / 100) * circumference;

    return (
      <div
        onClick={() => router.push("/calendar")}
        style={{
          margin: "4px 20px 8px",
          padding: 16,
          borderRadius: 18,
          background: "var(--sf)",
          border: "0.5px solid var(--bd)",
          cursor: "pointer",
          transition: "background 0.4s",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
            <svg viewBox="0 0 80 80" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
              <defs>
                <linearGradient id="stats-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--ac)" />
                  <stop offset="100%" stopColor="var(--ac2)" />
                </linearGradient>
              </defs>
              <circle cx="40" cy="40" r="32" fill="none" stroke="var(--sf3)" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="url(#stats-ring-gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.22,1,0.36,1)" }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <div style={{ fontFamily: "'Gaegu', cursive", fontSize: 20, fontWeight: 700, color: "var(--tp)", letterSpacing: "0.02em", lineHeight: 1 }}>
                {yearPct}%
              </div>
              <div style={{ fontSize: 8.5, color: "var(--tm)", fontWeight: 700, letterSpacing: "0.3px" }}>연간 목표</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Gaegu', cursive", fontSize: 14, fontWeight: 700, color: "var(--tp)", letterSpacing: "0.02em", marginBottom: 3 }}>
              {year}년 독서 여정
            </div>
            <div style={{ fontSize: 11, color: "var(--tm)", marginBottom: 10 }}>
              <span style={{ color: "var(--ac)", fontWeight: 700 }}>{finishedThisYear}권</span> 읽었어요 · {yGoal - finishedThisYear}권 남음
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--ts)", fontWeight: 600 }}>
              <span>🔥 <strong style={{ color: "var(--tp)", fontWeight: 800 }}>{streak}</strong>일</span>
              <span>📖 오늘 <strong style={{ color: "var(--tp)", fontWeight: 800 }}>{pagesReadToday}</strong>쪽</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // today_goal (기본)
  return (
    <div
      onClick={() => router.push("/calendar")}
      style={{
        margin: "4px 20px 8px",
        padding: 16,
        borderRadius: 18,
        background: "var(--sf)",
        border: "0.5px solid var(--bd)",
        cursor: "pointer",
        transition: "background 0.4s",
        boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
      }}
    >
      {/* 상단: 목표 제목 + 퍼센트 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Gaegu', cursive", fontSize: 14, fontWeight: 700, color: "var(--tp)", letterSpacing: "0.02em" }}>
          오늘 목표 · <span style={{ color: "var(--ac)" }}>{pageGoal}쪽</span>
        </div>
        <div style={{ fontSize: 11, color: progressPct >= 100 ? "var(--ac)" : "var(--tm)", fontWeight: 700 }}>
          {progressPct >= 100 ? "달성!" : `${progressPct}%`}
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div style={{ height: 10, background: "var(--sf2)", borderRadius: 100, overflow: "hidden", marginBottom: 6, position: "relative" }}>
        <div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, var(--ac), var(--ac2))",
            borderRadius: 100,
            width: `${progressPct}%`,
            boxShadow: progressPct > 0 ? "0 2px 8px color-mix(in srgb, var(--ac) 25%, transparent)" : "none",
            transition: "width 1s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>

      {/* 상세 */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--tm)", fontWeight: 600, marginBottom: 12 }}>
        <span>
          <strong style={{ color: "var(--ac)", fontWeight: 800 }}>{pagesReadToday}쪽</strong> 읽었어요
        </span>
        <span>
          {progressPct >= 100 ? "목표 달성 👏" : `${Math.max(0, pageGoal - pagesReadToday)}쪽 남음`}
        </span>
      </div>

      {/* 푸터: 스트릭 + 연간 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "0.5px solid var(--bd)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ts)", fontWeight: 600 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: "color-mix(in srgb, var(--milestone, #B79556) 18%, var(--sf))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🔥</div>
          <span>
            <strong style={{ color: "var(--tp)", fontWeight: 800, fontSize: 13 }}>{streak}</strong>일 연속
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ts)", fontWeight: 600 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: "color-mix(in srgb, var(--ac) 15%, var(--sf))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>📚</div>
          <span>
            올해 <strong style={{ color: "var(--tp)", fontWeight: 800, fontSize: 13 }}>{finishedThisYear}</strong>
            {yearlyGoal ? (
              <span style={{ color: "var(--tm)" }}> / {yearlyGoal}권</span>
            ) : (
              <span style={{ color: "var(--tm)" }}>권</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
