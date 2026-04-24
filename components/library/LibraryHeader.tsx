"use client";

/* ═══════════════════════════════════════════════
   LibraryHeader — 서재 타이틀 + 전시 토글 (only)
   mockup-library-v1.html .lib-head 기반.
   뷰 선택(책꽂이/큐레이션/4스택)은 /settings/library-view에서 변경.
   ═══════════════════════════════════════════════ */

import type { LibraryView } from "@/stores/useLibraryViewStore";

function resolveNickname(raw?: string | null): string {
  const nick = raw?.trim();
  if (!nick) return "독서가";
  if (/^[\w.-]+@/.test(nick)) return "독서가";
  if (/\d{3,}/.test(nick)) return "독서가";
  if (/^[0-9]/.test(nick)) return "독서가";
  if (nick.length > 10) return nick.slice(0, 10);
  return nick;
}

export function LibraryHeader({
  nickname,
  totalBooks,
  exhibit,
  onExhibitToggle,
  view,
}: {
  nickname: string;
  totalBooks: number;
  exhibit: boolean;
  onExhibitToggle: () => void;
  view: LibraryView;
}) {
  const displayName = resolveNickname(nickname);

  const titleByView: Record<LibraryView, { main: string; em: string; sub: string }> = {
    A: { main: `${displayName}의`, em: "서재", sub: `MY LIBRARY · ${totalBooks} BOOKS` },
    B: { main: `${displayName}의`, em: "큐레이션", sub: `CURATED · ${totalBooks} BOOKS` },
    C: { main: "네 개의", em: "무더기", sub: `FOUR STACKS · ${totalBooks} BOOKS` },
  };
  const t = titleByView[view];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        padding: "18px 2px 14px",
        marginBottom: 8,
        borderBottom: "1px solid var(--bd)",
        gap: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            fontFamily: "var(--font-playful)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--tp)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          {t.main}{" "}
          <em style={{ fontStyle: "normal", color: "var(--ac2)" }}>{t.em}</em>
        </h1>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--tm)",
            marginTop: 5,
            textTransform: "uppercase",
          }}
        >
          {t.sub}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={exhibit}
        onClick={onExhibitToggle}
        aria-label={exhibit ? "전시 중 (공개) — 끄기" : "비공개 — 켜기"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          letterSpacing: "0.04em",
          color: "var(--ts)",
          whiteSpace: "nowrap",
          paddingBottom: 2,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          minHeight: 28,
        }}
      >
        <span>{exhibit ? "전시 중" : "비공개"}</span>
        <span
          aria-hidden
          style={{
            width: 30,
            height: 16,
            borderRadius: 10,
            background: exhibit ? "var(--ac)" : "var(--bd2)",
            position: "relative",
            flexShrink: 0,
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
            transition: "background var(--duration-fast) var(--easing-default)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: exhibit ? 16 : 2,
              width: 12,
              height: 12,
              background: "var(--sf)",
              borderRadius: "50%",
              boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
              transition: "left var(--duration-fast) var(--easing-default)",
            }}
          />
        </span>
      </button>
    </div>
  );
}
