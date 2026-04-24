"use client";

import { useMemo, useState } from "react";
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

// 책 표지 색상 (제목 해시로 일관된 색)
function coverColor(title: string): [string, string] {
  const palette: [string, string][] = [
    ["#C8A878", "#8B6B3C"], ["#B8A0C8", "#6B5C8E"],
    ["#A8C8B8", "#5E8E78"], ["#D8B098", "#986850"],
    ["#98B8C8", "#4E6E8E"], ["#C8A8B8", "#8E5E78"],
    ["#B8C098", "#707858"], ["#E0C890", "#B59E6A"],
  ];
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function trimTitle(title: string, max = 10): string {
  return title.length > max ? title.slice(0, max) + "…" : title;
}

/* ═══════════════════════════════════════════
   MascotHero — 책꽂이 위의 방긋이 (v2.1: 서재 위로)
   ═══════════════════════════════════════════
   - 단일 민트 그라데이션 (시간대 분기 제거)
   - 스트릭/하트는 StreakCard로 분리 (서재 아래로)
   - 말풍선 3줄: 인사 / 《책 제목》 / N쪽 · M일째
   - 방긋이는 선반 나무 위에 앉음
   - stage 여백 축소 → 서재가 화면 상단으로 올라옴
*/

type MascotVariant =
  | "idle" | "reading" | "happy" | "shelter" | "worried"
  | "welcome" | "thinking" | "writing" | "morning" | "talking";

export interface ShelfBook {
  id: string;
  title: string;
  coverUrl?: string | null;
  status?: "finished" | "wish" | "reading";
}

export interface MascotHeroContext {
  streak: number;
  streakDates: string[];
  lastReadDate?: string | null;
  currentPage?: number | null;
  currentBookTitle?: string | null;
  currentBookId?: string | null;
  daysOnCurrentBook?: number | null;
  justFinishedBook?: boolean;
  hasUnreadBooks: boolean;
  shelfBooks?: ShelfBook[];
}

type Speech = {
  greet: string;
  book?: string;
  prog?: string;
  fallback?: string;
};

function pickMascotState(ctx: MascotHeroContext, nickname: string): {
  variant: MascotVariant;
  speech: Speech;
} {
  const today = new Date().toISOString().slice(0, 10);
  const hello = `안녕, ${nickname}님`;

  if (ctx.justFinishedBook) {
    return { variant: "happy", speech: { greet: `${nickname}님, 완독!`, fallback: "축하해요 🎉" } };
  }
  if (ctx.lastReadDate) {
    const diffDays = Math.floor(
      (new Date(today).getTime() - new Date(ctx.lastReadDate).getTime()) / 86400000
    );
    if (diffDays >= 2) {
      return { variant: "worried", speech: { greet: hello, fallback: `${diffDays}일 동안 못 만났어요` } };
    }
  }
  if (ctx.currentPage && ctx.currentBookTitle) {
    const shortTitle = trimTitle(ctx.currentBookTitle);
    const days = ctx.daysOnCurrentBook ?? 0;
    const prog = days > 0
      ? `${ctx.currentPage}쪽 · ${days}일째`
      : `${ctx.currentPage}쪽부터`;
    return {
      variant: "reading",
      speech: { greet: hello, book: `《${shortTitle}》`, prog },
    };
  }
  if (ctx.currentBookTitle) {
    const shortTitle = trimTitle(ctx.currentBookTitle);
    return {
      variant: "reading",
      speech: { greet: hello, book: `《${shortTitle}》`, prog: "같이 읽어요" },
    };
  }
  if (ctx.streak >= 7) {
    return { variant: "happy", speech: { greet: hello, fallback: `${ctx.streak}일째 함께해요!` } };
  }
  if (!ctx.hasUnreadBooks) {
    return { variant: "welcome", speech: { greet: hello, fallback: "같이 읽을 책 골라봐요" } };
  }
  return { variant: "welcome", speech: { greet: hello, fallback: "오늘도 한 장 같이 읽어요" } };
}

export default function MascotHero({
  context,
  onTap,
  onBookTap,
}: {
  context: MascotHeroContext;
  onTap?: () => void;
  onBookTap?: (bookId: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const nickname = useMemo(() => resolveNickname(user?.nickname), [user?.nickname]);
  const state = useMemo(() => pickMascotState(context, nickname), [context, nickname]);
  const [bouncing, setBouncing] = useState(false);

  const handleMascotTap = () => {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 500);
    onTap?.();
  };

  // 단일 민트톤 그라데이션 — 시간대 분기 제거
  const bgGradient =
    "linear-gradient(180deg, color-mix(in srgb, var(--ac, #5FA48E) 11%, var(--bg)) 0%, color-mix(in srgb, var(--ac, #5FA48E) 3%, var(--bg)) 55%, var(--bg) 100%)";

  const realBooks = context.shelfBooks || [];
  const MAX_BOOKS = 24;
  const visibleBooks = realBooks.slice(0, MAX_BOOKS);
  const emptySlots = Math.max(2, Math.min(4, MAX_BOOKS - visibleBooks.length));

  return (
    <div
      style={{
        position: "relative",
        padding: "6px 0 0",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes mascot-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-10px) scale(1.04); }
          60% { transform: translateY(0) scale(0.98); }
          80% { transform: translateY(-3px) scale(1.01); }
        }
        .mascot-bouncing { animation: mascot-bounce 500ms var(--easing-bounce, cubic-bezier(0.34,1.56,0.64,1)); }
        .banggut-shelf-scroll {
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
        }
        .banggut-shelf-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* 단일 민트톤 배경 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: bgGradient,
        }}
      />

      {/* 책꽂이 무대 — 책 + 방긋이 + 말풍선 (marginTop 축소: 서재 위로) */}
      <div style={{ position: "relative", height: 186, marginTop: 10 }}>
        {/* ── 말풍선 (구조화된 3줄) ── */}
        <div
          style={{
            position: "absolute",
            top: -4,
            right: 32,
            zIndex: 4,
            width: 112,
            height: 112,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "transparent",
              border: "1.25px solid color-mix(in srgb, var(--ac, #5FA48E) 70%, transparent)",
              boxShadow:
                "0 0 0 2px color-mix(in srgb, var(--ac, #5FA48E) 14%, transparent), " +
                "0 0 12px color-mix(in srgb, var(--ac, #5FA48E) 45%, transparent), " +
                "0 0 22px color-mix(in srgb, var(--ac, #5FA48E) 25%, transparent), " +
                "inset 0 0 10px color-mix(in srgb, var(--ac, #5FA48E) 18%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "14px 14px",
              fontFamily: "var(--font-playful)",
              fontWeight: 700,
              color: "var(--ac-deep, #3A6B56)",
              letterSpacing: "var(--ls-gaegu, 0.01em)",
              lineHeight: 1.32,
            }}
          >
            <div>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "var(--ts)",
                  marginBottom: 2,
                }}
              >
                {state.speech.greet}
              </span>
              {state.speech.book && (
                <span
                  style={{
                    display: "block",
                    fontFamily:
                      "var(--font-body, 'Pretendard Variable', sans-serif)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: "var(--tp)",
                    marginBottom: 2,
                  }}
                >
                  {state.speech.book}
                </span>
              )}
              {state.speech.prog && (
                <span
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    color: "var(--ac-deep, #3A6B56)",
                  }}
                >
                  {state.speech.prog}
                </span>
              )}
              {state.speech.fallback && (
                <span style={{ display: "block", fontSize: 12.5 }}>
                  {state.speech.fallback}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 방긋이 — 선반 나무 위에 앉음 (위치 아래로 내림) */}
        <button
          onClick={handleMascotTap}
          aria-label="방긋이"
          style={{
            position: "absolute",
            right: 8,
            bottom: -18,
            zIndex: 3,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            lineHeight: 0,
          }}
        >
          <img
            src={`/mascot-${state.variant}.png`}
            alt="방긋이"
            className={bouncing ? "mascot-bouncing" : ""}
            style={{
              width: 138,
              height: 138,
              objectFit: "contain",
              filter:
                "drop-shadow(0 6px 12px color-mix(in srgb, var(--ac) 20%, rgba(0,0,0,0.1)))",
              display: "block",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/mascot-happy.png";
            }}
          />
        </button>

        {/* 책꽂이 */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 14,
            right: 14,
            zIndex: 1,
          }}
        >
          <div
            className="banggut-shelf-scroll"
            style={{ height: 170, position: "relative" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 1.5,
                paddingLeft: 6,
                paddingRight: 140,
                height: "100%",
                width: "max-content",
              }}
            >
              {visibleBooks.map((book) => {
                let h = 0;
                for (let c = 0; c < book.title.length; c++)
                  h = (h * 31 + book.title.charCodeAt(c)) | 0;
                const height = 146 + (Math.abs(h) % 24);
                const width = 22 + (Math.abs(h >> 3) % 11);
                const [bg, fg] = coverColor(book.title);
                const isWish = book.status === "wish";
                const titleForSpine = book.title.slice(0, 10);
                const hasCover = !!book.coverUrl;

                return (
                  <div
                    key={book.id}
                    onClick={() => onBookTap?.(book.id)}
                    style={{
                      width,
                      height,
                      flexShrink: 0,
                      borderRadius: "1.5px 1.5px 0 0",
                      overflow: "hidden",
                      position: "relative",
                      opacity: isWish ? 0.7 : 1,
                      cursor: onBookTap ? "pointer" : "default",
                      transition: "transform 0.2s ease",
                      scrollSnapAlign: "start",
                      boxShadow:
                        "inset -1.5px 0 0 rgba(0,0,0,0.18), " +
                        "inset 1px 0 0 rgba(255,255,255,0.2), " +
                        "0 -1px 3px rgba(0,0,0,0.08)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.transform = "translateY(-3px)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.transform = "")
                    }
                    title={book.title}
                  >
                    {hasCover && (
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundImage: `url(${book.coverUrl})`,
                          backgroundSize: `auto ${height}px`,
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                          filter: "saturate(1.15) contrast(1.05)",
                        }}
                      />
                    )}
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: hasCover
                          ? `linear-gradient(180deg, ${fg}99 0%, ${bg}4D 40%, ${fg}B3 100%)`
                          : `linear-gradient(180deg, ${bg}, ${fg})`,
                        mixBlendMode: hasCover ? "multiply" : "normal",
                      }}
                    />
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(90deg, " +
                          "rgba(255,255,255,0.18) 0%, " +
                          "rgba(255,255,255,0.04) 12%, " +
                          "rgba(0,0,0,0) 50%, " +
                          "rgba(0,0,0,0.12) 88%, " +
                          "rgba(0,0,0,0.25) 100%)",
                        pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 5,
                        left: 3,
                        right: 3,
                        height: 0.75,
                        background:
                          "linear-gradient(90deg, rgba(255,225,160,0.55), rgba(255,225,160,0.85), rgba(255,225,160,0.55))",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 6,
                        left: 3,
                        right: 3,
                        height: 0.75,
                        background:
                          "linear-gradient(90deg, rgba(255,225,160,0.55), rgba(255,225,160,0.85), rgba(255,225,160,0.55))",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 16,
                        bottom: 16,
                        left: 0,
                        right: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        writingMode: "vertical-lr",
                        textOrientation: "mixed",
                        fontSize: width >= 28 ? 11 : 10,
                        fontFamily:
                          "var(--font-body, 'Pretendard Variable', sans-serif)",
                        fontWeight: 800,
                        color: "#fff",
                        textShadow:
                          "0 1px 2px rgba(0,0,0,0.55), 0 0 4px rgba(0,0,0,0.3)",
                        letterSpacing: "-0.02em",
                        overflow: "hidden",
                        padding: "0 2px",
                        lineHeight: 1.05,
                        userSelect: "none",
                      }}
                    >
                      {titleForSpine}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 1.5,
                        background:
                          "linear-gradient(90deg, rgba(255,255,255,0.65), rgba(255,255,255,0.15))",
                      }}
                    />
                    {book.status === "reading" && (
                      <div
                        style={{
                          position: "absolute",
                          top: 3,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "var(--ac)",
                          boxShadow:
                            "0 0 0 1.5px #fff, 0 0 6px rgba(95,164,142,0.6)",
                        }}
                      />
                    )}
                  </div>
                );
              })}

              {Array.from({ length: emptySlots }).map((_, i) => {
                const height = 150 + ((i * 7) % 22);
                const width = 24 + ((i * 3) % 8);
                return (
                  <div
                    key={`empty-${i}`}
                    style={{
                      width,
                      height,
                      flexShrink: 0,
                      borderRadius: "2px 2px 0 0",
                      background:
                        "color-mix(in srgb, var(--ac-deep, #3A6B56) 5%, transparent)",
                      border:
                        "0.5px dashed color-mix(in srgb, var(--ac-deep, #3A6B56) 14%, transparent)",
                      borderBottom: "none",
                      opacity: 0.5,
                    }}
                  />
                );
              })}
            </div>
          </div>
          {/* 나무 선반 */}
          <div
            style={{
              height: 7,
              background: "linear-gradient(180deg, #A68456 0%, #7A5A38 100%)",
              boxShadow:
                "0 -1px 0 rgba(255,255,255,0.18) inset, 0 3px 8px rgba(0,0,0,0.16)",
              borderRadius: "1.5px",
              marginLeft: -4,
              marginRight: -4,
            }}
          />
        </div>
      </div>
    </div>
  );
}
