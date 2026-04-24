"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, MessageCircle } from "lucide-react";
import { coverPalette, upgradeCoverUrl } from "@/lib/reading-utils";
import type { V1CNudgeData } from "./types";
import {
  CoverThumb,
  decoBottomLeft,
  decoTopRight,
  heroShellBase,
} from "./shared";

/**
 * V1-C · 넛지형 HERO
 * 스크랩도 없고 진입도 안 한 책일 때, 최소한의 "대화 진입 칩"만 보여줍니다.
 * AI는 한 마디도 쓰지 않고, 사용자가 먼저 말하도록 유도해요.
 */
export default function V1CNudge({ data }: { data: V1CNudgeData }) {
  const router = useRouter();
  const { book } = data;

  const coverUrl = useMemo(
    () => upgradeCoverUrl(book.cover_url),
    [book.cover_url]
  );
  const [coverBg, coverFg] = useMemo(
    () => coverPalette(book.title),
    [book.title]
  );

  const handleChat = () => router.push(`/book/${book.id}#chat`);
  const handleOpen = () => router.push(`/book/${book.id}`);

  return (
    <div
      style={{
        ...heroShellBase,
        background: "linear-gradient(155deg, var(--ac) 0%, var(--ac2) 100%)",
        boxShadow: "0 8px 24px color-mix(in srgb, var(--ac) 22%, transparent)",
        padding: 16,
      }}
    >
      <div aria-hidden style={decoTopRight} />
      <div aria-hidden style={decoBottomLeft} />

      {/* 책 정보 — 살짝 컴팩트 */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
        aria-label={`${book.title} 시작하기`}
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
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
          width={48}
          height={68}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              opacity: 0.82,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 3,
            }}
          >
            아직 첫 장 전이에요
          </div>
          <div
            style={{
              fontSize: 15,
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
          {book.author && (
            <div
              style={{
                fontSize: 11,
                opacity: 0.78,
                marginTop: 2,
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {book.author}
            </div>
          )}
        </div>
      </div>

      {/* 대화 진입 칩 (질문 없이 최소 넛지만) */}
      <button
        type="button"
        onClick={handleChat}
        aria-label="방긋이랑 이 책 얘기하기"
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "var(--acc)",
          padding: "11px 14px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontFamily: "inherit",
          minHeight: 44,
          marginBottom: 8,
          position: "relative",
          transition: "transform var(--duration-fast) var(--easing-default)",
        }}
        onMouseDown={(e) =>
          (e.currentTarget.style.transform = "translateY(-1px)")
        }
        onMouseUp={(e) => (e.currentTarget.style.transform = "")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      >
        <MessageCircle size={14} strokeWidth={2.5} />
        방긋이랑 이 책 얘기해요
        <ArrowRight size={13} strokeWidth={2.5} />
      </button>

      {/* 서브 CTA — 바로 읽기 */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`${book.title} 읽기 시작`}
        style={{
          width: "100%",
          background: "var(--sf)",
          color: "var(--ac2)",
          border: "none",
          padding: 12,
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
          position: "relative",
          transition: "transform var(--duration-fast) var(--easing-default)",
        }}
        onMouseDown={(e) =>
          (e.currentTarget.style.transform = "translateY(-1px)")
        }
        onMouseUp={(e) => (e.currentTarget.style.transform = "")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      >
        <BookOpen size={14} strokeWidth={2.5} />
        읽기 시작하기
      </button>
    </div>
  );
}
