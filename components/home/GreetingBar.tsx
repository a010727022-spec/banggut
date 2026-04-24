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

function pickGreeting(hour: number): { text: string; mascot: string } {
  if (hour >= 5 && hour < 11)
    return { text: "오늘도 한 장 펼쳐볼까요?", mascot: "mascot-morning" };
  if (hour >= 11 && hour < 14)
    return { text: "점심 잘 챙기고 한 장 같이 읽어요", mascot: "mascot-happy" };
  if (hour >= 14 && hour < 18)
    return { text: "오후에도 같이 한 장 읽어볼까요?", mascot: "mascot-reading" };
  if (hour >= 18 && hour < 22)
    return { text: "오늘도 수고했어요. 잠시 쉬어가요", mascot: "mascot-happy" };
  return { text: "편안한 밤이에요. 한 장만 더 펴볼까요?", mascot: "mascot-sleep" };
}

function formatToday(date: Date): string {
  const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${months[date.getMonth()]} ${date.getDate()}일 ${days[date.getDay()]}요일`;
}

/**
 * GreetingBar — 마스코트 원형 프레임 + 말풍선 카드.
 * mockup-home-v2.html Phone A 스타일.
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
        alignItems: "flex-end",
        gap: 10,
        padding: "8px 0 16px",
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

      {/* 마스코트 — 원형 프레임 */}
      <div
        style={{
          width: 54,
          height: 54,
          minWidth: 54,
          borderRadius: "50%",
          background: "var(--sf)",
          border: "1.5px solid var(--bd)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
          boxShadow: "0 1px 0 color-mix(in srgb, var(--tp) 4%, transparent), 2px 3px 0 color-mix(in srgb, var(--tp) 6%, transparent)",
        }}
      >
        <img
          src={`/${greeting.mascot}.png`}
          alt="방긋이"
          className="banggut-mascot-bob"
          style={{
            width: "92%",
            height: "92%",
            objectFit: "contain",
            display: "block",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/mascot-happy.png";
          }}
        />
      </div>

      {/* 말풍선 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: "var(--sf)",
          border: "1.5px solid var(--tp)",
          borderRadius: "16px 16px 16px 4px",
          padding: "10px 14px",
          boxShadow: "0 1px 0 color-mix(in srgb, var(--tp) 4%, transparent), 2px 3px 0 color-mix(in srgb, var(--tp) 8%, transparent)",
          transition:
            "background var(--duration-slow) var(--easing-default), border-color var(--duration-slow) var(--easing-default)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-playful)",
            color: "var(--tm)",
            fontSize: 12,
            lineHeight: 1.2,
            marginBottom: 2,
            letterSpacing: "var(--ls-gaegu)",
          }}
        >
          방긋이 · {dateLabel}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--tp)",
            lineHeight: 1.45,
            letterSpacing: "-0.01em",
          }}
        >
          <b style={{ fontWeight: 700, color: "var(--ac)" }}>{nickname}</b>님,{" "}
          {greeting.text}
        </div>
      </div>
    </div>
  );
}
