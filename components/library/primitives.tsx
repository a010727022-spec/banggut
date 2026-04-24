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

/* ─── BookSpine: 세로 책등 ───────────────────────────
 * 목업 .spine 스타일. coverUrl이 있으면 표지 이미지를 책등 모양으로 잘라서
 * 배경으로 깔고, 아래쪽에 어둡게 그라디언트 + 제목을 오버레이 해요.
 * 제목 폰트 크기를 넉넉히 키워서 한글도 읽히도록 맞췄어요.
 */
export function BookSpine({
  title,
  heightHint,
  onClick,
  compact = false,
  coverUrl,
}: {
  title: string;
  heightHint?: SpineHeight;
  onClick?: () => void;
  compact?: boolean;
  coverUrl?: string | null;
}) {
  const variant = pickVariant(title);
  const h = SPINE_HEIGHTS[heightHint ?? pickHeight(title)];
  const width = compact ? 28 : 36;
  const height = compact ? Math.max(70, h - 40) : h;
  const hasImage = !!coverUrl;
  const titleSize = compact ? 9.5 : 11;

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
        background: hasImage ? "#2a2a2a" : variant.bg,
        color: hasImage ? "#fff" : variant.fg,
        // 책등도 선반 위에서 그림자를 드리우도록 외부 shadow 강화
        boxShadow: [
          "inset 0 -2px 3px rgba(0,0,0,0.2)",
          "inset 1.5px 0 0 rgba(255,255,255,0.15)",
          "inset -1px 0 0 rgba(0,0,0,0.22)",
          "0 5px 6px -3px rgba(40,25,10,0.35)",
          "0 2px 3px -1px rgba(40,25,10,0.2)",
        ].join(", "),
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
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
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl ?? undefined}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // 책등은 세로로 가늘기 때문에 표지의 중앙 세로선을 쓰면 제목이 보일 확률이 높아요
            objectPosition: "center",
          }}
        />
      )}
      {/* 아래쪽 어둡게 — 제목 오버레이 가독성용 */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: hasImage
            ? "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.82) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.12) 100%)",
          pointerEvents: "none",
        }}
      />
      {/* 세로 제목 */}
      <span
        style={{
          position: "relative",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontSize: titleSize,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          padding: "8px 0 10px",
          maxHeight: "100%",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          textShadow: hasImage
            ? "0 1px 2px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,0.6)"
            : "none",
          lineHeight: 1,
        }}
      >
        {title}
      </span>
    </button>
  );
}

/* ─── BookFront: 정면 표지 (미니) ───────────────────
 * "표지 모드" 쉘프용 — 표지를 작게 정면으로 보여주고 아래에 제목 2줄까지.
 * coverUrl이 있으면 실제 이미지, 없으면 제목 기반 그라디언트로 폴백.
 */
export function BookFront({
  title,
  author,
  coverUrl,
  onClick,
  compact = false,
  variantOffset = 0,
}: {
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  onClick?: () => void;
  compact?: boolean;
  variantOffset?: number;
}) {
  const gradient = pickCoverGradient(title, variantOffset);
  const w = compact ? 56 : 68;
  const h = compact ? 80 : 96;
  const hasImage = !!coverUrl;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title} 상세 보기`}
      style={{
        width: w,
        minWidth: w,
        display: "flex",
        flexDirection: "column",
        gap: 5,
        flexShrink: 0,
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: w,
          height: h,
          borderRadius: "2px 4px 4px 2px",
          overflow: "hidden",
          position: "relative",
          background: hasImage
            ? gradient.from
            : `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
          color: gradient.fg,
          // 책이 선반에 드리우는 그림자:
          //  · 위에서 오는 빛을 받아 아래쪽에 진한 그림자가 퍼져요
          //  · inset 테두리는 책등/옆면 입체감
          boxShadow: [
            "0 6px 8px -3px rgba(40,25,10,0.38)",
            "0 3px 4px -2px rgba(40,25,10,0.28)",
            "0 1px 2px rgba(40,25,10,0.2)",
            "inset 2px 0 0 rgba(0,0,0,0.22)",
            "inset -1px 0 0 rgba(255,255,255,0.12)",
          ].join(", "),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: hasImage ? 0 : "8px 8px",
          transition: "transform var(--duration-fast) var(--easing-default)",
        }}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl ?? undefined}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-playful)",
              fontSize: compact ? 10.5 : 11.5,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              textAlign: "center",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: "var(--tp)",
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textAlign: "left",
          wordBreak: "keep-all",
          // 책이 나란히 섰을 때 높이가 균일하도록 2줄 공간을 미리 잡아요.
          minHeight: `${10.5 * 1.25 * 2}px`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 9,
          color: "var(--tm)",
          lineHeight: 1.3,
          display: "-webkit-box",
          WebkitLineClamp: 1,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          // 저자 없을 때도 한 줄 자리를 비워 두어 선반 위 라벨 높이를 맞춰요.
          minHeight: `${9 * 1.3}px`,
        }}
      >
        {author ?? ""}
      </div>
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

/* ─── ShelfWood: 쉘프 나무 바 ───────────────────────────
 * 레퍼런스 서점 큐레이션 선반 느낌.
 * · 두께 12px 오크 나무 상판
 * · 맨 위 얇은 "앞면 모서리" 라인으로 3D 입체감
 * · 가로 나무결(repeating-linear-gradient)로 일러스트 디테일
 * · 아래쪽 바깥 그림자로 "선반이 공간에 떠 있는" 느낌
 *
 * stretch=true — CoverShelfRow/HorizontalShelf 내부처럼 부모 flex 컬럼에서
 *   본인 너비를 채워야 할 때 사용. 기본값은 기존 레이아웃 유지 (오른쪽 테이퍼).
 */
export function ShelfWood({ stretch = false }: { stretch?: boolean } = {}) {
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        // stretch 모드에선 콘텐츠 폭을 가득 채우고, 아닐 땐 오른쪽을 살짝 자르던 기존 간격 유지
        margin: stretch ? 0 : "0 14px -2px -2px",
        alignSelf: stretch ? "stretch" : undefined,
        height: 12,
        borderRadius: "2px 2px 1.5px 1.5px",
        background: [
          // 가로 나무결 — 밝은 톤 위에 아주 옅게 얹어요
          "repeating-linear-gradient(0deg, rgba(88,55,22,0.05) 0, rgba(88,55,22,0.05) 1px, transparent 1px, transparent 3px)",
          // 맨 위 앞면 모서리 (진한 라인 → 부드럽게 넘어가는 오크 상판)
          "linear-gradient(180deg, rgba(82,52,22,0.85) 0%, rgba(118,82,42,0.6) 2px, rgba(214,177,128,1) 3px, rgba(222,186,138,1) 6px, rgba(198,158,105,1) 10px, rgba(142,95,46,0.9) 100%)",
        ].join(", "),
        boxShadow: [
          // 아래로 떨어지는 그림자 (선반이 공중에 잠깐 떠 있는 느낌)
          "0 4px 6px -1px rgba(40,25,10,0.28)",
          "0 2px 3px -1px rgba(40,25,10,0.18)",
          // 위쪽 하이라이트 (반사광)
          "inset 0 1px 0 rgba(255,235,200,0.28)",
          // 아래 바닥 어두운 라인
          "inset 0 -1px 0 rgba(55,30,10,0.35)",
        ].join(", "),
      }}
    />
  );
}

/* ─── CoverShelfRow: 표지 + 선반 + 라벨 3-row 스크롤 ───
 * 레퍼런스 서점 큐레이션 — 표지가 *정면으로 선반 위에 서 있고*,
 * 선반 아래에 셸프 토커(제목 + 저자)가 라벨처럼 붙어요.
 * 세 줄(표지/선반/라벨)이 같은 가로 스크롤 컨테이너에 묶여 함께 움직여요.
 *
 * 기존 BookFront는 "표지 + 제목 + 저자"가 세로로 쌓여 있는 형태라
 * "선반 위에 책이 서 있는" 은유가 약했어요. 이 컴포넌트는 그 은유를
 * 구조적으로 분리해 선반의 존재감을 살립니다.
 */
export function CoverShelfRow({
  books,
  size = "default",
  compact, // deprecated — size prop 권장, 하위 호환용
  upgradeCoverUrl,
  onBookClick,
}: {
  books: Pick<Book, "id" | "title" | "author" | "cover_url">[];
  /** compact: 큐레이션 카드 내부 · default: 일반 가로 쉘프 · large: 탭 기반 서재 메인 선반 */
  size?: "compact" | "default" | "large";
  /** @deprecated — size="compact" 와 동일. 기존 호출부 하위 호환용. */
  compact?: boolean;
  upgradeCoverUrl?: (url: string | null) => string | null;
  onBookClick?: (bookId: string) => void;
}) {
  if (books.length === 0) return null;
  const resolveUrl = (u: string | null) =>
    upgradeCoverUrl ? upgradeCoverUrl(u) : u;

  // 하위 호환: compact=true 가 들어오면 size="compact" 로 매핑
  const resolvedSize: "compact" | "default" | "large" = compact ? "compact" : size;

  // 표지 치수 — 서점 큐레이션 메인 선반은 일반보다 훨씬 크게 잡아요.
  // perRow: 360px 모바일 컨테이너 기준 한 단에 들어갈 책 수 (선반이 넘치지 않게)
  const DIMS = {
    compact: { w: 58, baseH: 82, gap: 10, labelFs: 10, perRow: 4 },
    default: { w: 72, baseH: 100, gap: 12, labelFs: 10.5, perRow: 4 },
    large: { w: 96, baseH: 138, gap: 14, labelFs: 11.5, perRow: 3 },
  } as const;
  const { w, baseH, gap, labelFs, perRow } = DIMS[resolvedSize];
  const labelGap = 6;

  // 책을 perRow 단위 청크로 나눠 여러 단의 선반으로 렌더해요.
  // 가로 스크롤 대신 아래로 선반이 자라나는 구조예요.
  const rows: Array<typeof books> = [];
  for (let i = 0; i < books.length; i += perRow) {
    rows.push(books.slice(i, i + perRow));
  }

  return (
    <div
      style={{
        position: "relative",
        margin: "0 -2px",
        padding: "4px 2px 4px",
      }}
    >
      {rows.map((rowBooks, rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: rowIdx === 0 ? 0 : 14,
          }}
        >
          {/* Row 1 — 표지들이 선반 위에 '서 있는' 모습 */}
          <div
            style={{
              display: "flex",
              gap,
              alignItems: "flex-end",
              paddingBottom: 0,
            }}
          >
            {rowBooks.map((b, i) => {
              // 해시 기반으로 높이를 -8 ~ +6 px 흔들어서 책 높이가 살짝씩 달라 보여요
              const globalIdx = rowIdx * perRow + i;
              const bump = ((hashSeed(b.title) + globalIdx) % 5) * 3 - 6;
              const h = baseH + bump;
              return (
                <CoverOnly
                  key={b.id}
                  title={b.title}
                  coverUrl={resolveUrl(b.cover_url ?? null)}
                  width={w}
                  height={h}
                  onClick={onBookClick ? () => onBookClick(b.id) : undefined}
                />
              );
            })}
          </div>

          {/* Row 2 — 오크 선반 (콘텐츠 폭 전체로 이어져요) */}
          <ShelfWood stretch />

          {/* Row 3 — 셸프 토커 (표지 아래 붙는 미니 라벨) */}
          <div
            style={{
              display: "flex",
              gap,
              alignItems: "flex-start",
              paddingTop: labelGap,
            }}
          >
            {rowBooks.map((b) => (
              <div
                key={b.id}
                style={{
                  width: w,
                  minWidth: w,
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    fontSize: labelFs,
                    fontWeight: 700,
                    color: "var(--tp)",
                    lineHeight: 1.25,
                    letterSpacing: "-0.01em",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    wordBreak: "keep-all",
                    minHeight: `${labelFs * 1.25 * 2}px`,
                  }}
                >
                  {b.title}
                </div>
                <div
                  style={{
                    fontSize: Math.max(9, labelFs - 1.5),
                    color: "var(--tm)",
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    // 저자 없을 때도 한 줄 자리를 비워 라벨 높이를 맞춰요.
                    minHeight: `${Math.max(9, labelFs - 1.5) * 1.3}px`,
                    marginTop: 2,
                  }}
                >
                  {b.author ?? ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── CoverOnly: 라벨 없는 정면 표지 (CoverShelfRow 전용 내부 블록) ───
 * BookFront 와 유사하지만 "라벨 없이 표지만" 렌더해서 레이아웃을
 * CoverShelfRow 쪽에서 세 행으로 분리할 수 있게 해요.
 */
function CoverOnly({
  title,
  coverUrl,
  width,
  height,
  onClick,
}: {
  title: string;
  coverUrl?: string | null;
  width: number;
  height: number;
  onClick?: () => void;
}) {
  const gradient = pickCoverGradient(title);
  const hasImage = !!coverUrl;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      aria-label={onClick ? `${title} 상세 보기` : undefined}
      style={{
        width,
        minWidth: width,
        height,
        borderRadius: "2px 4px 4px 2px",
        overflow: "hidden",
        position: "relative",
        background: hasImage
          ? gradient.from
          : `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
        color: gradient.fg,
        // 책이 선반 위에 서 있을 때 드리우는 그림자 — 아래로 진한 drop-shadow 강조
        boxShadow: [
          "0 7px 10px -3px rgba(40,25,10,0.42)",
          "0 3px 5px -2px rgba(40,25,10,0.3)",
          "0 1px 2px rgba(40,25,10,0.22)",
          "inset 2px 0 0 rgba(0,0,0,0.22)",
          "inset -1px 0 0 rgba(255,255,255,0.12)",
        ].join(", "),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: hasImage ? 0 : "8px 8px",
        flexShrink: 0,
        border: "none",
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
        transition: "transform var(--duration-fast) var(--easing-default)",
      }}
      onMouseEnter={
        onClick
          ? (e: React.MouseEvent<HTMLElement>) =>
              (e.currentTarget.style.transform = "translateY(-3px)")
          : undefined
      }
      onMouseLeave={
        onClick
          ? (e: React.MouseEvent<HTMLElement>) =>
              (e.currentTarget.style.transform = "")
          : undefined
      }
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl ?? undefined}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: "var(--font-playful)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            textAlign: "center",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </span>
      )}
    </Tag>
  );
}

/* ─── HorizontalShelf: 가로 스크롤 쉘프 ───────────
 * mode="spine" · 책등 모드 (나무 바 아래)
 * mode="cover" · 정면 모드 (표지 + 제목 아래)
 * coverUrl이 있으면 표지 이미지를 그대로 씁니다.
 */
export function HorizontalShelf({
  books,
  onBookClick,
  mode = "spine",
  upgradeCoverUrl,
}: {
  books: Pick<Book, "id" | "title" | "author" | "cover_url">[];
  onBookClick?: (bookId: string) => void;
  mode?: "spine" | "cover";
  upgradeCoverUrl?: (url: string | null) => string | null;
}) {
  if (books.length === 0) return null;
  const resolveUrl = (u: string | null) => (upgradeCoverUrl ? upgradeCoverUrl(u) : u);

  if (mode === "cover") {
    // 책이 선반 위에 서 있고, 선반 아래에 셸프 토커가 붙는 3-row 구조.
    return (
      <div style={{ margin: "0 -4px" }}>
        <CoverShelfRow
          books={books}
          upgradeCoverUrl={upgradeCoverUrl}
          onBookClick={onBookClick}
        />
      </div>
    );
  }

  // 책등 모드 — 세로 책등들이 선반 위에 서 있어요 (wood는 스크롤 컨테이너와
  // 동일한 폭으로 이어져서 끝까지 하나의 선반처럼 보여요).
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
          display: "inline-flex",
          flexDirection: "column",
          minWidth: "100%",
          padding: "4px 20px 0 2px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 3,
            alignItems: "flex-end",
            minHeight: 130,
          }}
        >
          {books.map((b) => (
            <BookSpine
              key={b.id}
              title={b.title}
              coverUrl={resolveUrl(b.cover_url ?? null)}
              onClick={onBookClick ? () => onBookClick(b.id) : undefined}
            />
          ))}
        </div>
        <ShelfWood stretch />
      </div>
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
