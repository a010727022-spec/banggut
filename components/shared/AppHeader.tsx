"use client";

import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { getAvatarSrc } from "@/lib/types";
import { calcStreak } from "@/lib/reading-utils";

/* HeroCanvas / TempWidget 제거 — 인사말은 방긋이 말풍선으로 이동, 헤더는 아바타+알림만 */

/* ═══ AppHeader 메인 ═══ */
export default function AppHeader({
  streakDates,
}: {
  streakDates: string[];
  counts?: { reading: number; done: number; want: number };
}) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const streak = calcStreak(streakDates);

  const avatarSrc = getAvatarSrc(user?.emoji);

  return (
    <>
      {/* 미니 헤더 — 아바타 + 알림만 (인사말은 방긋이 말풍선으로 이동) */}
      <div
        style={{
          padding: "14px 20px 2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        {/* 아바타 */}
        <button
          onClick={() => router.push("/profile")}
          aria-label="프로필"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            overflow: "hidden",
            flexShrink: 0,
            border: "0.5px solid var(--bd2)",
            background: "linear-gradient(135deg, var(--ac3, #A4D4C0), var(--ac))",
            padding: 0,
            cursor: "pointer",
            position: "relative",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : user?.emoji ? (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: "var(--sf)" }}>
              {user.emoji}
            </div>
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20 }}>
              👤
            </div>
          )}
          {streak > 0 && (
            <div
              style={{
                position: "absolute",
                bottom: -2,
                right: -4,
                background: "linear-gradient(135deg, #c8a030, #e8c040)",
                borderRadius: 100,
                padding: "1px 5px",
                fontSize: 8.5,
                fontWeight: 800,
                color: "#1a1000",
                border: "1.5px solid var(--bg)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Flame size={8} strokeWidth={2.5} />
              {streak}
            </div>
          )}
        </button>

        {/* 알림 벨 */}
        <button
          aria-label="알림"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "var(--sf)",
            border: "0.5px solid var(--bd)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
            flexShrink: 0,
            padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ts)" strokeWidth="2">
            <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 00-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
            <path d="M9 17a3 3 0 006 0" />
          </svg>
        </button>
      </div>

    </>
  );
}
