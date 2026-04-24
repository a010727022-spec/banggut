"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Calendar as CalendarIcon,
  Users,
} from "lucide-react";
import { coverPalette, upgradeCoverUrl } from "@/lib/reading-utils";
import type { V3GroupData } from "./types";
import {
  CoverThumb,
  decoBottomLeft,
  decoTopRight,
  getProgress,
  ghostCtaOnAccent,
  heroShellBase,
  primaryCtaMint,
} from "./shared";

/**
 * V3 · 모임 대비형 HERO
 * 책에 연결된 독서 모임이 있을 때 이 카드로 덮어씌워져요.
 * D-day 배지 + 내 진행률 + 모임 정보 + 한 줄 넛지 + 분기 CTA.
 *
 * "토론 질문"은 AI가 만들지 않아요 — 정적인 넛지만 ("한 줄 남기면 멤버도 봐요").
 * 책 본문 지식이 필요 없어서 환각 0%예요.
 */
export default function V3Group({ data }: { data: V3GroupData }) {
  const router = useRouter();
  const { book, dday, groupName, roundNumber } = data;

  const coverUrl = useMemo(
    () => upgradeCoverUrl(book.cover_url),
    [book.cover_url]
  );
  const [coverBg, coverFg] = useMemo(
    () => coverPalette(book.title),
    [book.title]
  );
  const progress = useMemo(() => getProgress(book), [book]);

  // D-day 라벨 (null이면 "진행 중", 음수면 "마감 D+N")
  const ddayLabel = useMemo(() => {
    if (dday == null) return null;
    if (dday === 0) return "D-DAY";
    if (dday > 0) return `D-${dday}`;
    return `D+${Math.abs(dday)}`;
  }, [dday]);

  const pagesRemaining =
    book.total_pages && book.current_page != null
      ? Math.max(0, book.total_pages - book.current_page)
      : null;

  const groupId = book.group_books?.group_id ?? null;

  const handleContinue = () => router.push(`/book/${book.id}`);
  const handleGroup = () => {
    if (groupId) router.push(`/groups/${groupId}`);
    else router.push("/groups");
  };

  return (
    <div
      style={{
        ...heroShellBase,
        background:
          "linear-gradient(160deg, #2d7159 0%, var(--ac) 60%, var(--ac2) 100%)",
        boxShadow: "0 8px 24px color-mix(in srgb, var(--ac) 32%, transparent)",
      }}
    >
      <div aria-hidden style={decoTopRight} />
      <div aria-hidden style={decoBottomLeft} />

      {/* D-day 알약 */}
      {ddayLabel && (
        <span
          aria-label={`모임 마감 ${ddayLabel}`}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "#E76F51",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.02em",
            padding: "4px 9px",
            borderRadius: 999,
            boxShadow: "0 3px 8px rgba(231, 111, 81, 0.4)",
            zIndex: 2,
          }}
        >
          {ddayLabel}
        </span>
      )}

      {/* 상단 뱃지 — 모임 정보 */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          opacity: 0.92,
          marginBottom: 12,
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          paddingRight: ddayLabel ? 52 : 0,
        }}
      >
        <CalendarIcon size={11} strokeWidth={2.5} />
        {groupName} · {roundNumber}회차
      </div>

      {/* 책 정보 */}
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
              <div style={{ fontSize: 11.5, opacity: 0.82 }}>
                {book.author}
                {pagesRemaining != null && pagesRemaining > 0
                  ? ` · ${pagesRemaining}쪽 남았어요`
                  : ""}
              </div>
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

      {/* 준비 팁 (정적 문구) */}
      <div
        style={{
          background: "rgba(255,255,255,0.16)",
          border: "1px solid rgba(255,255,255,0.26)",
          borderRadius: 12,
          padding: "10px 12px",
          marginBottom: 12,
          fontSize: 11.5,
          lineHeight: 1.5,
          letterSpacing: "-0.01em",
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <Users size={13} strokeWidth={2.5} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>
          이번 장에서 <b style={{ fontWeight: 800 }}>한 줄</b> 남기면
          다른 멤버도 볼 수 있어요
        </span>
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
          onClick={handleContinue}
          style={primaryCtaMint}
          aria-label={`${book.title} 이어 읽기`}
          onMouseDown={(e) =>
            (e.currentTarget.style.transform = "translateY(-1px)")
          }
          onMouseUp={(e) => (e.currentTarget.style.transform = "")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
        >
          <BookOpen size={14} strokeWidth={2.5} />
          이어 읽기
        </button>
        <button
          type="button"
          onClick={handleGroup}
          style={ghostCtaOnAccent}
          aria-label={`${groupName} 모임 페이지로 이동`}
          onMouseDown={(e) =>
            (e.currentTarget.style.transform = "translateY(-1px)")
          }
          onMouseUp={(e) => (e.currentTarget.style.transform = "")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
        >
          모임 준비
          <ArrowRight size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
