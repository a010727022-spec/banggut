"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, AlignLeft, BookOpen } from "lucide-react";
import { coverPalette, upgradeCoverUrl } from "@/lib/reading-utils";
import type { Book, Scrap } from "@/lib/types";

function getProgress(b: Book): number {
  if (b.format === "ebook") return b.progress_percent || 0;
  if (b.total_pages && b.current_page)
    return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
  if (b.reading_status === "finished") return 100;
  return 0;
}

/**
 * ContinueHeroCard (Theme A) — 대형 민트 그라데이션 이어 읽기 카드.
 * 표지 + 제목/저자 + 진행률 + "어제 마지막 문장" 컨텍스트(one_liner 또는 최신 스크랩) + CTA.
 * 읽는 중 책이 없으면 렌더하지 않음 (부모가 조건부로 호출).
 */
export default function ContinueHeroCard({
  book,
  lastScrap,
}: {
  book: Book;
  lastScrap?: Scrap | null;
}) {
  const router = useRouter();

  const coverUrl = useMemo(() => upgradeCoverUrl(book.cover_url), [book.cover_url]);
  const [coverBg, coverFg] = useMemo(() => coverPalette(book.title), [book.title]);
  const progress = useMemo(() => getProgress(book), [book]);

  // 컨텍스트: one_liner(한 줄 감상) 우선, 없으면 최신 스크랩
  const contextText = book.one_liner || lastScrap?.text || null;
  // 목업과 동일한 라벨 — 책을 덮고 나서 마지막으로 멈춘 자리의 문장이라는 의미
  const contextLabel = "어제 마지막 문장";

  const handleContinue = () => router.push(`/book/${book.id}`);

  return (
    <div
      style={{
        borderRadius: 22,
        padding: 18,
        color: "var(--acc)",
        marginBottom: 14,
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(155deg, var(--ac) 0%, var(--ac2) 100%)",
        boxShadow: "0 8px 24px color-mix(in srgb, var(--ac) 22%, transparent)",
        transition:
          "background var(--duration-slow) var(--easing-default), box-shadow var(--duration-slow) var(--easing-default)",
      }}
    >
      {/* 장식 원 */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -60,
          right: -40,
          width: 180,
          height: 180,
          background: "rgba(255,255,255,0.06)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: -80,
          left: -30,
          width: 140,
          height: 140,
          background: "rgba(255,255,255,0.04)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      {/* 상단 뱃지 */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          opacity: 0.85,
          marginBottom: 12,
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Clock size={11} strokeWidth={2.5} />
        어제 멈춘 곳
      </div>

      {/* 본문 */}
      <div
        onClick={handleContinue}
        style={{
          display: "flex",
          gap: 14,
          marginBottom: 12,
          position: "relative",
          cursor: "pointer",
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleContinue();
          }
        }}
      >
        {/* 표지 */}
        <div
          style={{
            width: 84,
            height: 120,
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
                fontSize: 19,
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: "-0.02em",
                marginBottom: 4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {book.title}
            </div>
            {book.author && (
              <div style={{ fontSize: 12, opacity: 0.8 }}>{book.author}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, marginTop: 12 }}>
            <div>
              <b
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  display: "block",
                  fontFamily: "var(--font-playful)",
                  lineHeight: 1,
                  marginBottom: 2,
                }}
              >
                {book.current_page ?? 0}
              </b>
              <span style={{ opacity: 0.78, fontSize: 10 }}>
                {book.total_pages ? `쪽 / ${book.total_pages}` : "쪽"}
              </span>
            </div>
            <div>
              <b
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  display: "block",
                  fontFamily: "var(--font-playful)",
                  lineHeight: 1,
                  marginBottom: 2,
                }}
              >
                {progress}%
              </b>
              <span style={{ opacity: 0.78, fontSize: 10 }}>완독률</span>
            </div>
          </div>
        </div>
      </div>

      {/* 마지막 문장 / 한 줄 감상 */}
      {contextText && (
        <div
          style={{
            background: "rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: "11px 13px",
            fontFamily: "var(--font-playful)",
            fontSize: 14,
            lineHeight: 1.5,
            marginBottom: 12,
            position: "relative",
            letterSpacing: "var(--ls-gaegu)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              opacity: 0.75,
              marginBottom: 4,
              fontFamily: "var(--font-body)",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <AlignLeft size={10} strokeWidth={2.5} />
            {contextLabel}
          </div>
          <span
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            &ldquo;{contextText}&rdquo;
          </span>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleContinue}
        type="button"
        aria-label={`${book.title} 이어 읽기`}
        style={{
          background: "var(--sf)",
          color: "var(--ac2)",
          border: "none",
          width: "100%",
          padding: 13,
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontFamily: "inherit",
          minHeight: 44,
          transition: "transform var(--duration-fast) var(--easing-default)",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      >
        <BookOpen size={15} strokeWidth={2.5} />
        이어 읽기
        <ArrowRight size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}
