"use client";

import { useRouter } from "next/navigation";
import type { Book } from "@/lib/types";
import {
  HorizontalShelf,
  MiniShelfGrid,
  SectionHead,
  pickVariant,
} from "./primitives";

/* ═══════════════════════════════════════════════
   LibraryViewC — 4 스택 (정리벽 독자용)
   2×2 stacks-grid · 주간 하이라이트 · 올해의 완독 쉘프 ·
   mini-shelf (페이스/완독예정)
   ═══════════════════════════════════════════════ */

export function LibraryViewC({
  reading,
  finishedThisYear,
  wishBooks,
  borrowedBooks,
}: {
  reading: Book[];
  finishedThisYear: Book[];
  wishBooks: Book[];
  borrowedBooks: Book[];
}) {
  const router = useRouter();

  const stacks: StackData[] = [
    {
      no: 1,
      name: "읽는 중",
      count: reading.length,
      books: reading,
      onClick: () => reading[0] && router.push(`/book/${reading[0].id}`),
    },
    {
      no: 2,
      name: "올해 완독",
      count: finishedThisYear.length,
      books: finishedThisYear,
    },
    {
      no: 3,
      name: "위시 · 대기",
      count: wishBooks.length,
      books: wishBooks,
      onClick: () => wishBooks[0] && router.push(`/book/${wishBooks[0].id}`),
    },
    {
      no: 4,
      name: "대여 중",
      count: borrowedBooks.length,
      books: borrowedBooks,
      onClick: () =>
        borrowedBooks[0] && router.push(`/book/${borrowedBooks[0].id}`),
    },
  ];

  const upcomingWish = wishBooks.find((b) => b.plan_to_start_at);
  const paceInfo = estimatePace(reading[0]);

  return (
    <div>
      {/* 2×2 스택 그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          padding: "8px 0 12px",
        }}
      >
        {stacks.map((s) => (
          <StackCard key={s.no} {...s} />
        ))}
      </div>

      {/* 이번 주 한 권 */}
      <WeeklyHighlight upcomingWish={upcomingWish} featured={reading[0]} />

      {/* 올해의 완독 — 쉘프 */}
      <SectionHead
        title="올해의 완독"
        count={finishedThisYear.length}
        more={finishedThisYear.length > 0 ? "연도별" : undefined}
      />
      {finishedThisYear.length > 0 ? (
        <HorizontalShelf
          books={finishedThisYear}
          onBookClick={(id) => router.push(`/book/${id}`)}
        />
      ) : (
        <EmptyRow message="올해 완독하면 여기에 나무 쉘프로 쌓여요." />
      )}

      {/* mini-shelf: 페이스 / 완독 예정 */}
      <MiniShelfGrid
        items={[
          {
            label: "이번 달 페이스",
            value: paceInfo ? `${paceInfo.pagesPerDay}` : "-",
            unit: paceInfo ? "쪽/일" : undefined,
            body: paceInfo
              ? paceInfo.message
              : "읽기 기록이 쌓이면 페이스를 알려드릴게요.",
          },
          {
            label: "완독 예정",
            value: paceInfo?.etaLabel ?? "-",
            unit: paceInfo?.etaUnit,
            body: paceInfo?.etaBody ?? "읽는 중인 책을 등록해보세요.",
          },
        ]}
      />

      <div style={{ height: 24 }} />
    </div>
  );
}

/* ─── StackCard: 개별 무더기 카드 ─────────── */
type StackData = {
  no: number;
  name: string;
  count: number;
  books: Book[];
  onClick?: () => void;
};

function StackCard({ no, name, count, books, onClick }: StackData) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "var(--sf)",
        border: "1px solid var(--bd)",
        borderRadius: 14,
        padding: "13px 13px 12px",
        position: "relative",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
        cursor: onClick ? "pointer" : "default",
        transition:
          "transform var(--duration-fast) var(--easing-default), box-shadow var(--duration-fast) var(--easing-default)",
        textAlign: "left",
        fontFamily: "inherit",
        display: "flex",
        flexDirection: "column",
        minHeight: 140,
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: "0.2em",
          color: "var(--tm)",
          textTransform: "uppercase",
          marginBottom: 4,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        Stack {String(no).padStart(2, "0")}
      </div>
      <div
        style={{
          fontFamily: "var(--font-playful)",
          fontSize: 18,
          fontWeight: 700,
          color: "var(--tp)",
          lineHeight: 1.1,
          marginBottom: 8,
          letterSpacing: "-0.005em",
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: "var(--ac2)",
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {count}
        <span
          style={{
            fontSize: 11,
            color: "var(--tm)",
            fontWeight: 600,
            marginLeft: 3,
          }}
        >
          권
        </span>
      </div>

      {/* Stack pile (미니어처 무더기) */}
      <StackPile books={books} />
    </button>
  );
}

/* ─── StackPile: 책 무더기 미니어처 ───────────
   가로 바 (width 랜덤 = 책 두께) 세로로 쌓여요.
   제목 해시로 색상/폭 결정 → 같은 책은 동일 외형.
*/
function StackPile({ books }: { books: Book[] }) {
  if (books.length === 0) return null;
  const sample = books.slice(0, 7);
  const widths = [44, 38, 32, 44, 28, 38, 32]; // w3 w1 w2 w3 w4 w1 w2

  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "flex-end",
        gap: 2,
        marginTop: "auto",
        paddingRight: 2,
        paddingTop: 10,
      }}
    >
      {sample.map((b, i) => {
        const variant = pickVariant(b.title, i);
        const width = widths[i % widths.length];
        return (
          <span
            key={b.id}
            style={{
              display: "block",
              height: 7,
              width,
              borderRadius: 1,
              background: variant.bg,
              boxShadow:
                "inset 0 -1px 1px rgba(0,0,0,0.18), inset 1px 0 0 rgba(255,255,255,0.15)",
            }}
          />
        );
      })}
    </div>
  );
}

/* ─── WeeklyHighlight: 이번 주 한 권 ─────── */
function WeeklyHighlight({
  upcomingWish,
  featured,
}: {
  upcomingWish: Book | undefined;
  featured: Book | undefined;
}) {
  const message = (() => {
    if (upcomingWish) {
      const d = daysUntil(upcomingWish.plan_to_start_at);
      const dLabel =
        typeof d === "number"
          ? d === 0
            ? "D-0"
            : d > 0
              ? `D-${d}`
              : `D+${Math.abs(d)}`
          : "D-?";
      return {
        headline: "다음 주엔",
        bookTitle: upcomingWish.title,
        tail: `"읽는 중" 스택으로 합류해요. ${dLabel}.`,
      };
    }
    if (featured) {
      return {
        headline: "이번 주는",
        bookTitle: featured.title,
        tail: "이어 읽기에 집중해봐요.",
      };
    }
    return null;
  })();

  if (!message) {
    return (
      <div
        style={{
          marginTop: 14,
          padding: "14px 15px 13px",
          background: "var(--sf2)",
          borderRadius: 14,
          border: "1px dashed var(--bd2)",
          fontSize: 12.5,
          color: "var(--ts)",
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            color: "var(--tm)",
            textTransform: "uppercase",
            marginBottom: 6,
            fontWeight: 700,
          }}
        >
          This Week · 이번 주
        </div>
        위시 리스트에 시작 예정일을 등록하면 주간 하이라이트가 여기에 생겨요.
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: "14px 15px 13px",
        background: "color-mix(in srgb, var(--ac) 12%, var(--sf))",
        borderRadius: 14,
        border: "1px solid color-mix(in srgb, var(--ac) 35%, var(--bd))",
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          color: "var(--ac2)",
          textTransform: "uppercase",
          marginBottom: 6,
          fontWeight: 700,
        }}
      >
        This Week · 이번 주 한 권
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--tp)",
          lineHeight: 1.55,
          letterSpacing: "-0.005em",
        }}
      >
        {message.headline}{" "}
        <em
          style={{
            fontStyle: "normal",
            fontWeight: 800,
            color: "var(--ac2)",
          }}
        >
          {message.bookTitle}
        </em>
        가 {message.tail}
      </div>
    </div>
  );
}

/* ─── 유틸 ─────────── */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Math.ceil(
    (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  return diff;
}

function estimatePace(current: Book | undefined): {
  pagesPerDay: number;
  message: string;
  etaLabel: string;
  etaUnit?: string;
  etaBody: string;
} | null {
  if (!current || !current.current_page || !current.total_pages || !current.started_at)
    return null;

  const started = new Date(current.started_at).getTime();
  const days = Math.max(
    1,
    Math.round((Date.now() - started) / (1000 * 60 * 60 * 24)),
  );
  const pagesPerDay = Math.max(1, Math.round(current.current_page / days));
  const remaining = Math.max(0, current.total_pages - current.current_page);
  const etaDays = Math.ceil(remaining / pagesPerDay);
  const etaDate = new Date(Date.now() + etaDays * 24 * 60 * 60 * 1000);

  return {
    pagesPerDay,
    message:
      pagesPerDay >= 30
        ? `지금 페이스 ${pagesPerDay}쪽/일`
        : `하루 ${pagesPerDay}쪽씩 꾸준히`,
    etaLabel: etaDate.toLocaleDateString("ko", {
      month: "long",
      day: "numeric",
    }),
    etaBody: `『${current.title}』 · ${remaining}쪽 남음`,
  };
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "18px 16px",
        background: "var(--sf2)",
        border: "1px dashed var(--bd2)",
        borderRadius: 12,
        fontSize: 12,
        color: "var(--ts)",
        textAlign: "center",
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}
