"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

function resolveNickname(raw?: string | null): string {
  const nick = raw?.trim();
  if (!nick) return "독서가";
  if (/^[\w.-]+@/.test(nick)) return "독서가";
  if (/\d{3,}/.test(nick)) return "독서가";
  if (/^[0-9]/.test(nick)) return "독서가";
  if (nick.length > 10) return nick.slice(0, 10);
  return nick;
}

/** 시간대별 인사말 + 마스코트 변형 선택 */
function pickGreeting(hour: number): { text: string; mascot: string } {
  if (hour >= 5 && hour < 11)
    return { text: "좋은 아침이에요", mascot: "mascot-morning" };
  if (hour >= 11 && hour < 14)
    return { text: "점심 잘 챙겨요", mascot: "mascot-happy" };
  if (hour >= 14 && hour < 18)
    return { text: "오후에도 한 장 같이 읽어요", mascot: "mascot-reading" };
  if (hour >= 18 && hour < 22)
    return { text: "오늘도 수고했어요", mascot: "mascot-happy" };
  return { text: "편안한 밤이에요", mascot: "mascot-sleep" };
}

function formatToday(date: Date): string {
  const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return `오늘은 ${months[date.getMonth()]} ${date.getDate()}일 ${days[date.getDay()]}이에요`;
}

/**
 * GreetingBar — 두 테마(A/B) 공통 상단 인사말.
 * 시간대별 인사 + 원형 마스코트 + 오늘 날짜 라벨.
 */
export default function GreetingBar() {
  const user = useAuthStore((s) => s.user);

  const nickname = useMemo(() => resolveNickname(user?.nickname), [user?.nickname]);
  const now = useMemo(() => new Date(), []);
  const greeting = useMemo(() => pickGreeting(now.getHours()), [now]);
  const dateLabel = useMemo(() => formatToday(now), [now]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 2px 18px",
      }}
    >
      <style>{`
        @keyframes banggut-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .banggut-mascot-bob { animation: banggut-bob 3.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .banggut-mascot-bob { animation: none; }
        }
      `}</style>

      {/* 마스코트 — 동그라미 없이 그대로 */}
      <img
        src={`/${greeting.mascot}.png`}
        alt="방긋이"
        className="banggut-mascot-bob"
        style={{
          width: 56,
          height: 56,
          minWidth: 56,
          objectFit: "contain",
          display: "block",
          flexShrink: 0,
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/mascot-happy.png";
        }}
      />

      {/* 인사말 + 날짜 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <div
          style={{
            fontSize: 15,
            color: "var(--tp)",
            fontWeight: 600,
            letterSpacing: "-0.015em",
            lineHeight: 1.35,
            transition: "color var(--duration-slow) var(--easing-default)",
          }}
        >
          {greeting.text}, <b style={{ fontWeight: 700, color: "var(--ac)" }}>{nickname}</b>님
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--ts)",
            lineHeight: 1.4,
            transition: "color var(--duration-slow) var(--easing-default)",
          }}
        >
          {dateLabel}
        </div>
      </div>
    </div>
  );
}
