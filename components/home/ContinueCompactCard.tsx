"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { coverPalette, upgradeCoverUrl } from "@/lib/reading-utils";
import type { Book } from "@/lib/types";

function getProgress(b: Book): number {
  if (b.format === "ebook") return b.progress_percent || 0;
  if (b.total_pages && b.current_page)
    return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
  if (b.reading_status === "finished") return 100;
  return 0;
}

/**
 * ContinueCompactCard (Theme B) — 컴팩트 이어 읽기 + 진행률 바.
 * 읽는 중 책이 없으면 렌더하지 않음 (부모가 조건부로 호출).
 */
export default function ContinueCompactCard({ book }: { book: Book }) {
  const router = useRouter();

  const coverUrl = useMemo(() => upgradeCoverUrl(book.cover_url), [book.cover_url]);
  const [coverBg, coverFg] = useMemo(() => coverPalette(book.title), [book.title]);
  const progress = useMemo(() => getProgress(book), [book]);

  const handleContinue = () => router.push(`/book/${book.id}`);

  return (
    <div
      style={{
        background: "var(--sf)",
        borderRadius: 18,
        border: "0.5px solid var(--bd)",
        padding: 16,
        marginBottom: 8,
        boxShadow: "0 2px 8px color-mix(in srgb, var(--tp) 3%, transparent)",
        transition:
          "background var(--duration-slow) var(--easing-default), border-color var(--duration-slow) var(--easing-default)",
      }}
    >
      {/* 헤더: 라벨 + 진행률 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: "var(--ts)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          이어 읽기
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--ac)",
            fontWeight: 700,
          }}
        >
          <b
            style={{
              fontFamily: "var(--font-playful)",
              fontSize: 14,
              marginRight: 3,
            }}
          >
            {progress}%
          </b>
          완독
        </span>
      </div>

      {/* 본문: 표지 + 제목/쪽 */}
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
          gap: 13,
          marginBottom: 14,
          cursor: "pointer",
        }}
      >
        {/* 표지 (sm) */}
        <div
          style={{
            width: 78,
            height: 108,
            flexShrink: 0,
            borderRadius: 5,
            overflow: "hidden",
            position: "relative",
            boxShadow: "2px 4px 10px rgba(0,0,0,0.18)",
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
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 8px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-playful)",
                  fontSize: 12,
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
                {book.title}
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

        {/* 정보 */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "2px 0",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.25,
                marginBottom: 3,
                color: "var(--tp)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {book.title}
            </div>
            {book.author && (
              <div style={{ fontSize: 12, color: "var(--ts)" }}>{book.author}</div>
            )}
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                color: "var(--tp)",
                fontWeight: 600,
                marginTop: 12,
                display: "flex",
                alignItems: "baseline",
                gap: 4,
              }}
            >
              <b
                style={{
                  fontFamily: "var(--font-playful)",
                  fontSize: 17,
                  color: "var(--tp)",
                  fontWeight: 700,
                }}
              >
                {book.current_page ?? 0}
              </b>
              {book.total_pages ? `/ ${book.total_pages}쪽` : "쪽"}
            </div>
            <div
              style={{
                height: 5,
                background: "var(--sf3)",
                borderRadius: 100,
                overflow: "hidden",
                marginTop: 6,
                width: "100%",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, var(--ac), var(--ac2))",
                  borderRadius: 100,
                  width: `${progress}%`,
                  transition: "width var(--duration-normal) var(--easing-default)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handleContinue}
        type="button"
        aria-label={`${book.title} 이어 읽기`}
        style={{
          background: "var(--ac)",
          color: "var(--acc)",
          border: "none",
          width: "100%",
          padding: 15,
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontFamily: "inherit",
          minHeight: 48,
          transition:
            "background var(--duration-fast) var(--easing-default), transform var(--duration-fast) var(--easing-default)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background =
            "color-mix(in srgb, var(--ac) 80%, #000)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--ac)";
          e.currentTarget.style.transform = "";
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      >
        <BookOpen size={17} strokeWidth={2.5} />
        이어 읽기
        <ArrowRight size={17} strokeWidth={2.5} />
      </button>
    </div>
  );
}
