"use client";

import type { LibraryView } from "@/stores/useLibraryViewStore";

/* ═══════════════════════════════════════════════
   LibraryHeader — 서재 타이틀 + 전시 토글 + 뷰 피커
   mockup-library-v1.html .lib-head 기반
   ═══════════════════════════════════════════════ */

export function LibraryHeader({
  nickname,
  totalBooks,
  exhibit,
  onExhibitToggle,
  view,
  onViewChange,
}: {
  nickname: string;
  totalBooks: number;
  exhibit: boolean;
  onExhibitToggle: () => void;
  view: LibraryView;
  onViewChange: (v: LibraryView) => void;
}) {
  const titleByView: Record<LibraryView, { main: string; em: string; sub: string }> = {
    A: { main: `${nickname}의`, em: "서재", sub: `MY LIBRARY · ${totalBooks} BOOKS` },
    B: { main: `${nickname}의`, em: "큐레이션", sub: `CURATED · ${totalBooks} BOOKS` },
    C: { main: "네 개의", em: "무더기", sub: `FOUR STACKS · ${totalBooks} BOOKS` },
  };
  const t = titleByView[view];

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          padding: "18px 2px 12px",
          marginBottom: 4,
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

      <ViewPicker view={view} onChange={onViewChange} />
    </>
  );
}

/* ─── ViewPicker: A/B/C 세그먼트 토글 ─────────────── */
function ViewPicker({
  view,
  onChange,
}: {
  view: LibraryView;
  onChange: (v: LibraryView) => void;
}) {
  const OPTIONS: { id: LibraryView; label: string; sub: string }[] = [
    { id: "A", label: "책꽂이", sub: "Shelf" },
    { id: "B", label: "큐레이션", sub: "Board" },
    { id: "C", label: "4 스택", sub: "Stacks" },
  ];

  return (
    <div
      role="tablist"
      aria-label="서재 뷰 선택"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 4,
        background: "var(--sf2)",
        padding: 4,
        borderRadius: 12,
        margin: "12px 0 6px",
        border: "1px solid var(--bd)",
      }}
    >
      {OPTIONS.map((o) => {
        const active = view === o.id;
        return (
          <button
            key={o.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            style={{
              padding: "8px 4px",
              borderRadius: 8,
              border: "none",
              background: active ? "var(--sf)" : "transparent",
              color: active ? "var(--tp)" : "var(--ts)",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              minHeight: 44,
              justifyContent: "center",
              boxShadow: active ? "var(--shadow-sm)" : "none",
              transition:
                "background var(--duration-fast) var(--easing-default), color var(--duration-fast) var(--easing-default)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: active ? 700 : 600,
                letterSpacing: "-0.01em",
              }}
            >
              {o.label}
            </span>
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.14em",
                color: "var(--tm)",
                textTransform: "uppercase",
              }}
            >
              {o.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
