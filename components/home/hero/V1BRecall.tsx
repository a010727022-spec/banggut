"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, MessageCircle, Star } from "lucide-react";
import { coverPalette, upgradeCoverUrl } from "@/lib/reading-utils";
import type { V1BRecallData } from "./types";
import {
  CoverThumb,
  decoBottomLeft,
  decoTopRight,
  getProgress,
  ghostCtaOnAccent,
  heroBadge,
  heroShellBase,
  primaryCtaMint,
} from "./shared";

/**
 * V1-B · 회상형 HERO
 * "3일 전 · 별표 친 문장" 스타일로 사용자가 직접 쓴 스크랩을 보여줍니다.
 * AI가 쓴 말이 하나도 없어서 환각 0% — 모든 텍스트는 본인 스크랩 + 정적 문구예요.
 */
export default function V1BRecall({ data }: { data: V1BRecallData }) {
  const router = useRouter();
  const { book, scrap, daysSinceScrap } = data;

  const coverUrl = useMemo(
    () => upgradeCoverUrl(book.cover_url),
    [book.cover_url]
  );
  const [coverBg, coverFg] = useMemo(
    () => coverPalette(book.title),
    [book.title]
  );
  const progress = useMemo(() => getProgress(book), [book]);

  const dayLabel =
    daysSinceScrap === 0
      ? "오늘"
      : daysSinceScrap === 1
        ? "어제"
        : `${daysSinceScrap}일 전`;

  const bubbleLabel =
    scrap.page_number != null
      ? `${dayLabel} · ${scrap.page_number}쪽 스크랩`
      : `${dayLabel} · 직접 쓴 문장`;

  const handleChat = () => router.push(`/book/${book.id}#chat`);
  const handleContinue = () => router.push(`/book/${book.id}`);

  return (
    <div
      style={{
        ...heroShellBase,
        background: "linear-gradient(155deg, var(--ac) 0%, var(--ac2) 100%)",
        boxShadow: "0 8px 24px color-mix(in srgb, var(--ac) 22%, transparent)",
      }}
    >
      <div aria-hidden style={decoTopRight} />
      <div aria-hidden style={decoBottomLeft} />

      {/* 상단 뱃지 */}
      <div style={heroBadge}>
        <Star size={11} strokeWidth={2.5} />
        {daysSinceScrap === 0
          ? "오늘 쓴 문장이 이어져요"
          : `${daysSinceScrap}일 전 생각이 이어져요`}
      </div>

      {/* 스크랩 버블 — 본인이 쓴 문장 회상 */}
      <div
        style={{
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 14,
          padding: "12px 14px",
          marginBottom: 10,
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            opacity: 0.86,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 5,
            fontFamily: "var(--font-body)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              background: "#FFD87A",
              borderRadius: "50%",
              display: "inline-block",
            }}
          />
          {bubbleLabel}
        </div>
        <div
          style={{
            fontFamily: "var(--font-playful)",
            fontSize: 16,
            lineHeight: 1.5,
            letterSpacing: "var(--ls-gaegu)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          &ldquo;{scrap.text}&rdquo;
        </div>
      </div>

      {/* 연결 코멘트 (정적 · AI 안 건드림) */}
      <div
        style={{
          fontSize: 11.5,
          opacity: 0.92,
          lineHeight: 1.5,
          letterSpacing: "-0.01em",
          marginBottom: 12,
          padding: "0 2px",
          position: "relative",
        }}
      >
        지금 읽는 부분이 이 문장이랑 맞닿아 있어요
      </div>

      {/* 책 정보 compact */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleContinue}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleContinue();
          }
        }}
        aria-label={`${book.title} 상세로 이동`}
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          cursor: "pointer",
          marginBottom: 12,
          position: "relative",
        }}
      >
        <CoverThumb
          coverUrl={coverUrl}
          bg={coverBg}
          fg={coverFg}
          title={book.title}
          width={44}
          height={62}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.3,
              letterSpacing: "-0.01em",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {book.title}
          </div>
          <div
            style={{
              fontSize: 11,
              opacity: 0.82,
              marginTop: 2,
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {book.author ?? ""}
            {book.current_page ? ` · ${book.current_page}쪽까지` : ""}
          </div>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            opacity: 0.95,
            fontFamily: "var(--font-playful)",
            paddingRight: 2,
          }}
        >
          {progress}%
        </div>
      </div>

      {/* 분기 CTA: 대화 / 이어 읽기 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={handleChat}
          style={primaryCtaMint}
          aria-label="방긋이랑 이어서 생각해보기"
          onMouseDown={(e) =>
            (e.currentTarget.style.transform = "translateY(-1px)")
          }
          onMouseUp={(e) => (e.currentTarget.style.transform = "")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
        >
          <MessageCircle size={14} strokeWidth={2.5} />
          이어서 생각해보기
        </button>
        <button
          type="button"
          onClick={handleContinue}
          style={ghostCtaOnAccent}
          aria-label={`${book.title} 이어 읽기`}
          onMouseDown={(e) =>
            (e.currentTarget.style.transform = "translateY(-1px)")
          }
          onMouseUp={(e) => (e.currentTarget.style.transform = "")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
        >
          <BookOpen size={14} strokeWidth={2.5} />
          이어 읽기
          <ArrowRight size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
