"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { coverPalette, upgradeCoverUrl } from "@/lib/reading-utils";
import type { Book } from "@/lib/types";

function getProgress(b: Book): number {
  if (b.format === "ebook") return b.progress_percent || 0;
  if (b.total_pages && b.current_page)
    return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
  if (b.reading_status === "finished") return 100;
  return 0;
}

/** updated_at 기준 마지막 독서 시점 자연어 표기. */
function lastReadLabel(updatedAt?: string | null): string {
  if (!updatedAt) return "마지막";
  const last = new Date(updatedAt);
  if (isNaN(last.getTime())) return "마지막";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDay = new Date(last);
  lastDay.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (today.getTime() - lastDay.getTime()) / 86400000
  );
  if (diff <= 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff <= 6) return `${diff}일 전`;
  return "최근";
}

/**
 * ContinueCompactCard — mockup-home-v2.html `.cr.compact` Phone A 스타일.
 *  - 표지(54x78) + 제목/저자(serif)
 *  - sage-bg 컨텍스트 박스 ("어제 N쪽에서 멈췄어요")
 *  - 진행률 바 + 퍼센트
 *  - 다크 잉크 CTA
 */
export default function ContinueCompactCard({ book }: { book: Book }) {
  const router = useRouter();

  const coverUrl = useMemo(() => upgradeCoverUrl(book.cover_url), [book.cover_url]);
  const [coverBg, coverFg] = useMemo(() => coverPalette(book.title), [book.title]);
  const progress = useMemo(() => getProgress(book), [book]);
  const lastWhen = useMemo(() => lastReadLabel(book.updated_at), [book.updated_at]);

  const handleContinue = () => router.push(`/book/${book.id}`);
  const currentPage = book.current_page ?? 0;
  const totalPages = book.total_pages ?? 0;

  return (
    <div
      style={{
        background: "var(--sf)",
        borderRadius: 18,
        border: "1.5px solid var(--tp)",
        padding: 12,
        marginBottom: 14,
        boxShadow:
          "0 1px 0 color-mix(in srgb, var(--tp) 4%, transparent), 2px 4px 0 color-mix(in srgb, var(--tp) 8%, transparent)",
        transition:
          "background var(--duration-slow) var(--easing-default), border-color var(--duration-slow) var(--easing-default)",
      }}
    >
      {/* 본문: 표지 + 정보 */}
      <div
        onClick={handleContinue}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleContinue();
          }
        }}
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          cursor: "pointer",
        }}
      >
        {/* 표지 (compact 54x78, paperback look) */}
        <div
          style={{
            width: 54,
            height: 78,
            flexShrink: 0,
            borderRadius: "4px 8px 8px 4px",
            overflow: "hidden",
            position: "relative",
            boxShadow:
              "2px 3px 0 color-mix(in srgb, var(--tp) 14%, transparent)",
          }}
        >
          {coverUrl ? (
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
                background: `linear-gradient(135deg, ${coverBg}, ${coverFg})`,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "flex-start",
                padding: "10px 8px",
              }}
            >
              <span
                style={{
                  fontFamily: "Fraunces, 'Times New Roman', serif",
                  fontStyle: "italic",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.92)",
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {book.title}
              </span>
            </div>
          )}
          {/* 책등 그림자 */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 3,
              top: 0,
              bottom: 0,
              width: 2,
              background: "rgba(0,0,0,0.2)",
            }}
          />
        </div>

        {/* 정보 */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div
            style={{
              fontFamily: "Fraunces, 'Times New Roman', serif",
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--tp)",
              lineHeight: 1.25,
              marginBottom: 1,
              letterSpacing: "-0.01em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {book.title}
          </div>
          {book.author && (
            <div
              style={{
                fontSize: 10.5,
                color: "var(--ts)",
                marginBottom: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {book.author}
            </div>
          )}

          {/* 컨텍스트 박스 — sage bg */}
          {currentPage > 0 && (
            <div
              style={{
                background: "color-mix(in srgb, var(--ac) 14%, transparent)",
                borderRadius: 8,
                padding: "5px 8px",
                fontSize: 11,
                color: "var(--ac-deep)",
                lineHeight: 1.35,
                marginBottom: 6,
              }}
            >
              {lastWhen}{" "}
              <b style={{ fontWeight: 700, color: "var(--ac-deep)" }}>
                {currentPage}p
              </b>
              에서 멈췄어요
            </div>
          )}

          {/* 진행률 바 */}
          <div
            style={{
              height: 5,
              background: "var(--sf2)",
              borderRadius: 100,
              overflow: "hidden",
              marginBottom: 4,
              width: "100%",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg, var(--ac-deep), var(--ac))",
                borderRadius: 100,
                width: `${progress}%`,
                transition: "width var(--duration-normal) var(--easing-default)",
              }}
            />
          </div>

          {/* 진행률 텍스트 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              fontSize: 10,
              color: "var(--ts)",
            }}
          >
            <span>
              {currentPage}
              {totalPages > 0 ? ` / ${totalPages}p` : "p"}
            </span>
            <b
              style={{
                fontFamily: "var(--font-playful)",
                fontSize: 12,
                color: "var(--tp)",
                fontWeight: 700,
              }}
            >
              {progress}%
            </b>
          </div>
        </div>
      </div>

      {/* 다크 잉크 CTA */}
      <button
        onClick={handleContinue}
        type="button"
        aria-label={`${book.title} 이어 읽기`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: "100%",
          marginTop: 8,
          padding: 9,
          background: "var(--tp)",
          color: "var(--sf)",
          border: "none",
          borderRadius: 12,
          fontFamily: "inherit",
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          cursor: "pointer",
          minHeight: 40,
          boxShadow:
            "0 2px 0 color-mix(in srgb, var(--tp) 60%, transparent)",
          transition:
            "background var(--duration-fast) var(--easing-default), transform var(--duration-fast) var(--easing-default)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background =
            "color-mix(in srgb, var(--tp) 88%, var(--ac))";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--tp)";
          e.currentTarget.style.transform = "";
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      >
        <Play size={14} strokeWidth={2.5} fill="currentColor" />
        이어 읽기
      </button>
    </div>
  );
}
