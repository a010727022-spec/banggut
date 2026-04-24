"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { coverPalette, upgradeCoverUrl } from "@/lib/reading-utils";
import type { V1AOpenData } from "./types";
import {
  CoverThumb,
  decoBottomLeft,
  decoTopRight,
  getProgress,
  getStartedLabel,
  ghostCtaOnAccent,
  heroBadge,
  heroShellBase,
  primaryCtaMint,
} from "./shared";

/**
 * V1-A · 범용 질문형 HERO
 * 책 본문을 모르는 AI가 던질 수 있는 책-무관 오픈 질문을 보여줍니다.
 * 질문은 `resolver.ts`에서 책 ID 해시로 안정 선택 — 같은 책은 항상 같은 질문이에요.
 */
export default function V1AOpen({ data }: { data: V1AOpenData }) {
  const router = useRouter();
  const { book, question } = data;

  const coverUrl = useMemo(
    () => upgradeCoverUrl(book.cover_url),
    [book.cover_url]
  );
  const [coverBg, coverFg] = useMemo(
    () => coverPalette(book.title),
    [book.title]
  );
  const progress = useMemo(() => getProgress(book), [book]);
  const startedLabel = useMemo(() => getStartedLabel(book), [book]);

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
        <Sparkles size={11} strokeWidth={2.5} />
        {startedLabel ?? "오늘도 읽어볼까요?"}
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
          gap: 14,
          marginBottom: 12,
          position: "relative",
          cursor: "pointer",
        }}
      >
        <CoverThumb
          coverUrl={coverUrl}
          bg={coverBg}
          fg={coverFg}
          title={book.title}
          width={72}
          height={102}
        />
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
              <div style={{ fontSize: 11.5, opacity: 0.82 }}>{book.author}</div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              fontSize: 11,
              marginTop: 10,
            }}
          >
            <div>
              <b
                style={{
                  fontSize: 14,
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
                  fontSize: 14,
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

      {/* 범용 질문 버블 (AI가 책 본문을 몰라도 던질 수 있는 질문만) */}
      <div
        style={{
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 14,
          padding: "12px 14px",
          marginBottom: 12,
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            opacity: 0.86,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 5,
            fontFamily: "var(--font-body)",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <MessageCircle size={10} strokeWidth={2.5} />
          오늘의 오픈 질문
        </div>
        <div
          style={{
            fontFamily: "var(--font-playful)",
            fontSize: 16,
            lineHeight: 1.5,
            letterSpacing: "var(--ls-gaegu)",
            whiteSpace: "pre-line",
          }}
        >
          {question}
        </div>
      </div>

      {/* CTA */}
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
          aria-label="방긋이랑 대화로 답해보기"
          onMouseDown={(e) =>
            (e.currentTarget.style.transform = "translateY(-1px)")
          }
          onMouseUp={(e) => (e.currentTarget.style.transform = "")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
        >
          <MessageCircle size={14} strokeWidth={2.5} />
          대화로 답하기
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
