"use client";

import type { CSSProperties } from "react";
import type { Book } from "@/lib/types";

/* ─── 계산 유틸 ─── */

/** 진행률 퍼센트 (ebook은 progress_percent, 종이책은 페이지 기반) */
export function getProgress(b: Book): number {
  if (b.format === "ebook") return b.progress_percent || 0;
  if (b.total_pages && b.current_page)
    return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
  if (b.reading_status === "finished") return 100;
  return 0;
}

/** "오늘 시작했어요" · "어제 시작했어요" · "n일째 읽고 있어요". 앵커 없으면 null */
export function getStartedLabel(b: Book): string | null {
  const anchor = b.started_at ?? b.updated_at;
  if (!anchor) return null;
  const t = new Date(anchor).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  if (days === 0) return "오늘 시작했어요";
  if (days === 1) return "어제 시작했어요";
  return `${days}일째 읽고 있어요`;
}

/* ─── 공통 스타일 ─── */

/** HERO 카드 공용 쉘 스타일 — 그라데이션 배경은 variant에서 지정 */
export const heroShellBase: CSSProperties = {
  borderRadius: 22,
  padding: 18,
  color: "var(--acc)",
  marginBottom: 14,
  position: "relative",
  overflow: "hidden",
  transition:
    "background var(--duration-slow) var(--easing-default), box-shadow var(--duration-slow) var(--easing-default)",
};

/** 우상단 큰 장식 원 */
export const decoTopRight: CSSProperties = {
  position: "absolute",
  top: -60,
  right: -40,
  width: 180,
  height: 180,
  background: "rgba(255,255,255,0.06)",
  borderRadius: "50%",
  pointerEvents: "none",
};

/** 좌하단 작은 장식 원 */
export const decoBottomLeft: CSSProperties = {
  position: "absolute",
  bottom: -80,
  left: -30,
  width: 140,
  height: 140,
  background: "rgba(255,255,255,0.04)",
  borderRadius: "50%",
  pointerEvents: "none",
};

/** 상단 뱃지 (아이콘 + 텍스트) */
export const heroBadge: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  opacity: 0.92,
  marginBottom: 12,
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

/* ─── 책 표지 썸네일 ─── */

export function CoverThumb({
  coverUrl,
  bg,
  fg,
  title,
  width = 84,
  height = 120,
}: {
  coverUrl: string | null;
  bg: string;
  fg: string;
  title: string;
  width?: number;
  height?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        flexShrink: 0,
        borderRadius: 5,
        overflow: "hidden",
        position: "relative",
        boxShadow: "2px 4px 10px rgba(0,0,0,0.18)",
      }}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${bg}, ${fg})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 10px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-playful)",
              fontSize: 13,
              fontWeight: 700,
              color: "rgba(255,255,255,0.9)",
              letterSpacing: "var(--ls-gaegu)",
              textAlign: "center",
              lineHeight: 1.15,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </span>
        </div>
      )}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.12), transparent 28%)",
        }}
      />
    </div>
  );
}

/* ─── CTA 버튼 공통 스타일 ─── */

/** 민트/피치 HERO 위의 기본 CTA (흰 배경) */
export const primaryCtaMint: CSSProperties = {
  background: "var(--sf)",
  color: "var(--ac2)",
  border: "none",
  padding: "12px 10px",
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontFamily: "inherit",
  minHeight: 44,
  transition: "transform var(--duration-fast) var(--easing-default)",
};

/** 반투명 고스트 CTA (accent 배경 위) */
export const ghostCtaOnAccent: CSSProperties = {
  background: "rgba(255,255,255,0.15)",
  color: "var(--acc)",
  border: "1px solid rgba(255,255,255,0.3)",
  padding: "12px 10px",
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontFamily: "inherit",
  minHeight: 44,
  transition: "transform var(--duration-fast) var(--easing-default)",
};

/** 단일 CTA 풀폭 버전 */
export const primaryCtaFull: CSSProperties = {
  ...primaryCtaMint,
  width: "100%",
  padding: 13,
  fontSize: 14,
};
