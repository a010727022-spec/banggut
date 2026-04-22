"use client";

import { useRouter } from "next/navigation";
import type { Book } from "@/lib/types";
import { upgradeCoverUrl } from "@/lib/reading-utils";
import {
  BookCover,
  BookSpine,
  HorizontalShelf,
  MiniShelfGrid,
  SectionHead,
  ShelfWood,
  pickHeight,
} from "./primitives";

/* ═══════════════════════════════════════════════
   LibraryViewA — 책꽂이 은유
   지금 읽는 중 (featured) · 올해의 완독 (spine shelf) ·
   큐레이션 쉘프 (genre-based) · mini-shelf (위시/대여)
   ═══════════════════════════════════════════════ */

export function LibraryViewA({
  reading,
  finishedThisYear,
  allFinishedCount,
  wishBooks,
  borrowedBooks,
  curatedShelves,
}: {
  reading: Book[];
  finishedThisYear: Book[];
  allFinishedCount: number;
  wishBooks: Book[];
  borrowedBooks: Book[];
  curatedShelves: { name: string; reason: string; books: Book[] }[];
}) {
  const router = useRouter();

  const featured = reading[0];
  const progress =
    featured && featured.total_pages && featured.current_page
      ? Math.min(100, Math.round((featured.current_page / featured.total_pages) * 100))
      : 0;

  const upcomingWish = wishBooks.find((b) => b.plan_to_start_at);
  const upcomingBorrowed = borrowedBooks
    .filter((b) => b.due_date)
    .sort((a, b) =>
      (a.due_date ?? "").localeCompare(b.due_date ?? "")
    )[0];

  return (
    <div>
      {/* 지금 읽는 중 */}
      <SectionHead title="지금 읽는 중" count={reading.length} more="전체" />
      {featured ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "6px 2px 2px",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <BookCover
              title={featured.title}
              author={featured.author}
              kicker={featured.genre ?? "Book"}
              featured
              coverUrl={upgradeCoverUrl(featured.cover_url)}
              onClick={() => router.push(`/book/${featured.id}`)}
            />
          </div>
          <div style={{ flex: 1, paddingBottom: 6, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9.5,
                letterSpacing: "0.22em",
                color: "var(--tm)",
                textTransform: "uppercase",
                marginBottom: 3,
                fontWeight: 700,
              }}
            >
              {featured.current_page ? `p.${featured.current_page}` : "시작 전"}
              {featured.updated_at && ` · ${relativeKo(featured.updated_at)}`}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--tp)",
                lineHeight: 1.35,
                marginBottom: 4,
                letterSpacing: "-0.01em",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {featured.one_liner || `${featured.title} — 이어 읽을 차례예요`}
            </div>
            {featured.total_pages && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ts)",
                    fontVariantNumeric: "tabular-nums",
                    marginBottom: 6,
                  }}
                >
                  {progress}% · 남은{" "}
                  {Math.max(0, (featured.total_pages ?? 0) - (featured.current_page ?? 0))}쪽
                </div>
                <div
                  style={{
                    height: 4,
                    background: "var(--ac3)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${progress}%`,
                      background:
                        "linear-gradient(90deg, var(--ac), var(--ac2))",
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <EmptyRow message="아직 읽는 중인 책이 없어요." />
      )}

      {/* 올해의 완독 */}
      <SectionHead
        title="올해의 완독"
        count={finishedThisYear.length}
        more={allFinishedCount > finishedThisYear.length ? "연도별" : undefined}
      />
      {finishedThisYear.length > 0 ? (
        <HorizontalShelf
          books={finishedThisYear}
          onBookClick={(id) => router.push(`/book/${id}`)}
        />
      ) : (
        <EmptyRow message="올해 완독한 책이 기록되면 책등으로 전시돼요." />
      )}

      {/* 큐레이션 쉘프 — 장르 기반 자동 그룹 */}
      <SectionHead
        title="큐레이션 쉘프"
        count={curatedShelves.length}
        more="+ 새 쉘프"
      />
      {curatedShelves.length > 0 ? (
        curatedShelves.map((shelf) => (
          <CuratedCard key={shelf.name} shelf={shelf} />
        ))
      ) : (
        <EmptyRow message="읽은 책이 쌓이면 장르별 쉘프가 자동으로 생성돼요." />
      )}

      {/* mini-shelf: 위시 + 대여 */}
      <MiniShelfGrid
        items={[
          {
            label: "위시 리스트",
            value: `${wishBooks.length}`,
            unit: "권",
            body: upcomingWish
              ? `${upcomingWish.title} D-${daysUntil(upcomingWish.plan_to_start_at)} 시작`
              : wishBooks[0]
                ? `${wishBooks[0].title} 대기 중`
                : "담아둔 책이 없어요",
          },
          {
            label: "대여 중",
            value: `${borrowedBooks.length}`,
            unit: "권",
            body: upcomingBorrowed
              ? `가장 가까운 반납 ${formatDate(upcomingBorrowed.due_date)}`
              : borrowedBooks[0]
                ? borrowedBooks[0].title
                : "대여 중인 책 없음",
          },
        ]}
      />
    </div>
  );
}

/* ─── CuratedCard: 큐레이션 쉘프 카드 ─────────── */
function CuratedCard({
  shelf,
}: {
  shelf: { name: string; reason: string; books: Book[] };
}) {
  return (
    <div
      style={{
        background: "var(--sf)",
        border: "1px solid var(--bd)",
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <h4
          style={{
            fontFamily: "var(--font-playful)",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--tp)",
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          {shelf.name}
        </h4>
        <span
          style={{
            fontSize: 10,
            color: "var(--tm)",
            letterSpacing: "0.08em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {shelf.books.length}권
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--ts)",
          lineHeight: 1.55,
          marginBottom: 10,
          paddingLeft: 9,
          borderLeft: "2px solid var(--ac3)",
        }}
      >
        {shelf.reason}
      </div>
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
        {shelf.books.slice(0, 8).map((b) => (
          <BookSpine key={b.id} title={b.title} compact heightHint={pickHeight(b.title)} />
        ))}
      </div>
    </div>
  );
}

/* ─── 유틸 ─────────── */
function daysUntil(iso: string | null): number | string {
  if (!iso) return "?";
  const diff = Math.ceil(
    (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  return diff;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko", {
    month: "long",
    day: "numeric",
  });
}

/** "오늘" · "어제" · "3일 전" · 7일 이상은 짧은 날짜로 */
function relativeKo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const now = Date.now();
  const ms = now - t;
  const day = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor(ms / day);
  if (diffDays <= 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return `${diffDays}일 전`;
  return new Date(iso).toLocaleDateString("ko", {
    month: "short",
    day: "numeric",
  });
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
