"use client";

import type { CSSProperties } from "react";
import type { Book } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════
   Library 원자 프리미티브 — mockup-library-v1.html 기반
   책등 · 표지 · 쉘프 나무 바.
   책 컬러는 목업 고정 팔레트(sage/cream/oak/ink/berry/peach/rose/
   forest/dusk/clay) — 모든 테마에서 동일한 "책꽂이"의 느낌.
   ═══════════════════════════════════════════════════════════════ */

/** 책등 10단계 팔레트 (mockup-library-v1.html 의 .spine.v-* 와 동일). */
export const SPINE_VARIANTS: { bg: string; fg: string }[] = [
  { bg: "#84A98C", fg: "rgba(255,255,255,0.92)" },  // sage
  { bg: "#EFE3C8", fg: "#3A3320" },                 // cream
  { bg: "#A07B55", fg: "rgba(255,255,255,0.92)" },  // oak
  { bg: "#1E2A33", fg: "#EDE5D4" },                 // ink
  { bg: "#8B3A4E", fg: "#F7EAE9" },                 // berry
  { bg: "#D98D62", fg: "#2B1A10" },                 // peach
  { bg: "#C97C84", fg: "#4A2A2E" },                 // rose
  { bg: "#2E4D3F", fg: "#E8EDE8" },                 // forest
  { bg: "#6B5B93", fg: "#F0ECF7" },                 // dusk
  { bg: "#B7664F", fg: "#FFF2E8" },                 // clay
];

/** 표지 6단계 그라데이션 팔레트 (mockup-library-v1.html 의 .cover.v-* 와 동일). */
export const COVER_GRADIENTS: { from: string; to: string; fg: string }[] = [
  { from: "#A4C3A8", to: "#5B8968", fg: "#F5F8F0" }, // sage
  { from: "#3C4A54", to: "#1E2A33", fg: "#EDE5D4" }, // ink
  { from: "#B25A70", to: "#7A2D42", fg: "#F7EAE9" }, // berry
  { from: "#E6A8A8", to: "#C97C84", fg: "#4A2A2E" }, // rose
  { from: "#C79868", to: "#8B6640", fg: "#FBF2E0" }, // oak
  { from: "#8679B2", to: "#4C4074", fg: "#F0ECF7" }, // dusk
];

/** 큐레이터 셀 전용 6단계 그라데이션 (mockup-library-v1.html 의 .curator-cell .cv.v-*).
 *  표지보다 살짝 진한 끝 색으로 "쉘프 카드" 느낌을 냅니다. */
export const CURATOR_GRADIENTS: { from: string; to: string; fg: string }[] = [
  { from: "#A4C3A8", to: "#4F7A62", fg: "#F5F8F0" }, // sage
  { from: "#4C5D68", to: "#1E2A33", fg: "#EDE5D4" }, // ink
  { from: "#B25A70", to: "#6B2437", fg: "#F7EAE9" }, // berry
  { from: "#C79868", to: "#7C5A36", fg: "#FBF2E0" }, // oak
  { from: "#E6A8A8", to: "#A45F69", fg: "#4A2A2E" }, // rose
  { from: "#8679B2", to: "#3F356A", fg: "#F0ECF7" }, // dusk
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function pickVariant(seed: string, offset = 0): { bg: string; fg: string } {
  if (!seed) return SPINE_VARIANTS[0];
  return SPINE_VARIANTS[(hashSeed(seed) + offset) % SPINE_VARIANTS.length];
}

export function pickCoverGradient(
  seed: string,
  offset = 0
): { from: string; to: string; fg: string } {
  if (!seed) return COVER_GRADIENTS[0];
  return COVER_GRADIENTS[(hashSeed(seed) + offset) % COVER_GRADIENTS.length];
}

export function pickCuratorGradient(
  seed: string,
  offset = 0
): { from: string; to: string; fg: string } {
  if (!seed) return CURATOR_GRADIENTS[0];
  return CURATOR_GRADIENTS[(hashSeed(seed) + offset) % CURATOR_GRADIENTS.length];
}

/** 책등 높이 3단계 — 서재 리듬 연출 */
export type SpineHeight = "short" | "mid" | "tall";
const SPINE_HEIGHTS: Record<SpineHeight, number> = { short: 100, mid: 112, tall: 124 };

export function pickHeight(seed: string): SpineHeight {
  if (!seed) return "mid";
  const h = seed.charCodeAt(seed.length - 1) % 3;
  return h === 0 ? "short" : h === 1 ? "mid" : "tall";
}

/* ─── BookSpine: 세로 책등 ─────────────────────────── */
export function BookSpine({
  title,
  heightHint,
  onClick,
  compact = false,
}: {
  title: string;
  heightHint?: SpineHeight;
  onClick?: () => void;
  compact?: boolean;
}) {
  const variant = pickVariant(title);
  const h = SPINE_HEIGHTS[heightHint ?? pickHeight(title)];
  const width = compact ? 20 : 26;
  const height = compact ? Math.max(62, h - 50) : h;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title} 상세 보기`}
      style={{
        width,
        minWidth: width,
        height,
        position: "relative",
        cursor: "pointer",
        borderRadius: "1.5px 1.5px 0 0",
        background: variant.bg,
        color: variant.fg,
        boxShadow:
          "inset 0 -2px 3px rgba(0,0,0,0.2), inset 1.5px 0 0 rgba(255,255,255,0.15), inset -1px 0 0 rgba(0,0,0,0.22), 0 2px 0 rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "transform var(--duration-fast) var(--easing-default)",
        padding: 0,
        border: "none",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      onFocus={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
      onBlur={(e) => (e.currentTarget.style.transform = "")}
    >
      <span
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontSize: compact ? 7.5 : 9.5,
          fontWeight: 700,
          letterSpacing: "0.02em",
          padding: compact ? "4px 0" : "8px 0",
          maxHeight: "100%",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </span>
    </button>
  );
}

/* ─── BookCover: 정면 표지 ─────────────────────────── */
export function BookCover({
  title,
  author,
  kicker,
  featured = false,
  coverUrl,
  onClick,
  width,
  height,
  variantOffset = 0,
}: {
  title: string;
  author?: string | null;
  kicker?: string;
  featured?: boolean;
  coverUrl?: string | null;
  onClick?: () => void;
  width?: number;
  height?: number;
  variantOffset?: number;
}) {
  const gradient = pickCoverGradient(title, variantOffset);
  const w = width ?? (featured ? 90 : 82);
  const h = height ?? (featured ? 128 : 118);

  const hasImage = !!coverUrl;

  const baseStyle: CSSProperties = {
    width: w,
    minWidth: w,
    height: h,
    borderRadius: "2px 5px 5px 2px",
    position: "relative",
    cursor: onClick ? "pointer" : "default",
    color: gradient.fg,
    boxShadow:
      "0 2px 6px rgba(30,20,10,0.22), inset 2px 0 0 rgba(0,0,0,0.22), inset -1px 0 0 rgba(255,255,255,0.15)",
    padding: hasImage ? 0 : "10px 9px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    flexShrink: 0,
    transition: "transform var(--duration-fast) var(--easing-default)",
    overflow: "hidden",
    fontFamily: "inherit",
    border: "none",
    textAlign: "left",
  };

  const content = hasImage ? (
    <img
      src={coverUrl ?? undefined}
      alt=""
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  ) : (
    <>
      {kicker && (
        <div
          style={{
            fontSize: 7.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            opacity: 0.7,
            fontWeight: 700,
          }}
        >
          {kicker}
        </div>
      )}
      <div
        style={{
          fontSize: featured ? 12 : 11,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
          marginTop: 4,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {title}
      </div>
      {author && (
        <div style={{ fontSize: 8.5, opacity: 0.8, marginTop: "auto" }}>{author}</div>
      )}
    </>
  );

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      style={{
        ...baseStyle,
        background: hasImage
          ? gradient.from
          : `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
      }}
      onMouseEnter={
        onClick
          ? (e: React.MouseEvent<HTMLElement>) =>
              (e.currentTarget.style.transform = "translateY(-3px)")
          : undefined
      }
      onMouseLeave={
        onClick
          ? (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.transform = "")
          : undefined
      }
    >
      {content}
    </Tag>
  );
}

/* ─── ShelfWood: 쉘프 나무 바 ─────────────────────────── */
export function ShelfWood() {
  return (
    <div
      aria-hidden
      style={{
        height: 5,
        margin: "0 18px 0 -2px",
        background:
          "linear-gradient(180deg, rgba(130,96,54,0.55) 0%, rgba(80,55,25,0.7) 45%, rgba(55,38,15,0.55) 100%)",
        borderRadius: 1,
        boxShadow:
          "0 2px 5px rgba(30,20,10,0.22), inset 0 1px 0 rgba(255,230,180,0.25)",
      }}
    />
  );
}

/* ─── HorizontalShelf: 책등 가로 스크롤 쉘프 ─────────── */
export function HorizontalShelf({
  books,
  onBookClick,
}: {
  books: Pick<Book, "id" | "title">[];
  onBookClick?: (bookId: string) => void;
}) {
  if (books.length === 0) return null;
  return (
    <div
      style={{
        position: "relative",
        margin: "0 -20px 0 -4px",
        paddingLeft: 4,
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 3,
          alignItems: "flex-end",
          padding: "4px 20px 0 2px",
          minHeight: 130,
        }}
      >
        {books.map((b) => (
          <BookSpine
            key={b.id}
            title={b.title}
            onClick={onBookClick ? () => onBookClick(b.id) : undefined}
          />
        ))}
      </div>
      <ShelfWood />
    </div>
  );
}

/* ─── SectionHead: 섹션 헤더 (제목 + 카운트 + more) ─────── */
export function SectionHead({
  title,
  count,
  more,
  onMoreClick,
}: {
  title: string;
  count?: number;
  more?: string;
  onMoreClick?: () => void;
}) {
  return (
    <div
      style={{
        margin: "18px 0 4px",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "0 2px",
      }}
    >
      <h3
        style={{
          fontSize: 13.5,
          fontWeight: 700,
          color: "var(--tp)",
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        {title}
        {count !== undefined && (
          <span
            style={{
              fontWeight: 500,
              fontSize: 11,
              color: "var(--tm)",
              marginLeft: 5,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {count}
          </span>
        )}
      </h3>
      {more && (
        <button
          type="button"
          onClick={onMoreClick}
          style={{
            fontSize: 10,
            color: "var(--ac2)",
            letterSpacing: "0.08em",
            fontWeight: 600,
            cursor: onMoreClick ? "pointer" : "default",
            background: "transparent",
            border: "none",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          {more}
        </button>
      )}
    </div>
  );
}

/* ─── MiniShelfGrid: 위시·대여 mini 2-col ─────────── */
export function MiniShelfGrid({
  items,
}: {
  items: Array<{ label: string; value: string; unit?: string; body?: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginTop: 12,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            background: "var(--sf2)",
            border: "1px solid var(--bd)",
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              letterSpacing: "0.2em",
              color: "var(--tm)",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {it.label}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "var(--tp)",
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {it.value}
            {it.unit && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--tm)",
                  marginLeft: 3,
                }}
              >
                {it.unit}
              </span>
            )}
          </div>
          {it.body && (
            <div
              style={{
                fontSize: 10,
                color: "var(--ts)",
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              {it.body}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
