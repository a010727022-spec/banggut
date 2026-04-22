"use client";

import { useRouter } from "next/navigation";
import type { Book, Scrap } from "@/lib/types";
import { upgradeCoverUrl } from "@/lib/reading-utils";
import {
  BookSpine,
  SectionHead,
  pickCuratorGradient,
  pickHeight,
} from "./primitives";

/* ═══════════════════════════════════════════════
   LibraryViewB — 큐레이터 보드
   이달의 한 문장 (최근 스크랩) · 쉘프 썸네일 2-col 그리드 ·
   지금 읽는 중 (curated 카드)
   ═══════════════════════════════════════════════ */

export function LibraryViewB({
  reading,
  curatedShelves,
  latestScrap,
}: {
  reading: Book[];
  curatedShelves: { name: string; reason: string; books: Book[] }[];
  latestScrap: Scrap | null;
}) {
  const router = useRouter();

  return (
    <div>
      {/* 이달의 한 문장 */}
      {latestScrap ? (
        <QuoteOfMonth scrap={latestScrap} />
      ) : (
        <QuotePlaceholder />
      )}

      {/* 나의 쉘프 — 큐레이터 그리드 */}
      <SectionHead
        title="나의 쉘프"
        count={curatedShelves.length}
        more="+ 새 쉘프"
      />
      {curatedShelves.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            padding: "4px 0 10px",
          }}
        >
          {curatedShelves.slice(0, 6).map((shelf, idx) => (
            <CuratorCell
              key={shelf.name}
              shelf={shelf}
              index={idx}
              onClick={() => {
                const firstBook = shelf.books[0];
                if (firstBook) router.push(`/book/${firstBook.id}`);
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyRow message="완독한 책이 쌓이면 장르별로 쉘프가 자동으로 구성돼요." />
      )}

      {/* 지금 읽는 중 */}
      <SectionHead
        title="지금 읽는 중"
        count={reading.length}
        more={reading.length > 0 ? "이어읽기" : undefined}
        onMoreClick={
          reading[0] ? () => router.push(`/book/${reading[0].id}`) : undefined
        }
      />
      {reading[0] ? (
        <ReadingNowCard book={reading[0]} />
      ) : (
        <EmptyRow message="지금 읽는 중인 책이 없어요." />
      )}
    </div>
  );
}

/* ─── QuoteOfMonth: 최근 스크랩 → Gaegu 인용 ─────── */
function QuoteOfMonth({ scrap }: { scrap: Scrap }) {
  return (
    <div
      style={{
        background: "var(--sf2)",
        borderRadius: 12,
        padding: "14px 16px 15px",
        borderLeft: "3px solid var(--ac)",
        margin: "8px 0 10px",
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: "0.24em",
          color: "var(--ac2)",
          textTransform: "uppercase",
          marginBottom: 7,
          fontWeight: 700,
        }}
      >
        이달의 한 문장
      </div>
      <div
        style={{
          fontFamily: "var(--font-playful)",
          fontSize: 15.5,
          fontWeight: 700,
          color: "var(--tp)",
          lineHeight: 1.45,
          letterSpacing: "-0.005em",
          whiteSpace: "pre-wrap",
          wordBreak: "keep-all",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        &ldquo;{scrap.text}&rdquo;
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--tm)",
          marginTop: 8,
          letterSpacing: "0.02em",
        }}
      >
        {scrap.book_title ? `— 『${scrap.book_title}』` : "— 나의 필사 노트"}
        {scrap.book_author ? `, ${scrap.book_author}` : ""}
      </div>
    </div>
  );
}

function QuotePlaceholder() {
  return (
    <div
      style={{
        background: "var(--sf2)",
        borderRadius: 12,
        padding: "14px 16px 15px",
        borderLeft: "3px dashed var(--bd2)",
        margin: "8px 0 10px",
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: "0.24em",
          color: "var(--tm)",
          textTransform: "uppercase",
          marginBottom: 7,
          fontWeight: 700,
        }}
      >
        이달의 한 문장
      </div>
      <div
        style={{
          fontFamily: "var(--font-playful)",
          fontSize: 14,
          color: "var(--ts)",
          lineHeight: 1.5,
        }}
      >
        스크랩한 문장이 쌓이면 가장 최근 문장이 여기에 전시돼요.
      </div>
    </div>
  );
}

/* ─── CuratorCell: 쉘프 썸네일 셀 ─────────── */
function CuratorCell({
  shelf,
  index,
  onClick,
}: {
  shelf: { name: string; reason: string; books: Book[] };
  index: number;
  onClick?: () => void;
}) {
  // 대표 책 표지: 첫 책에 cover_url이 있으면 그것으로, 없으면 큐레이터 그라데이션
  const cover = shelf.books[0];
  const coverUrl = cover?.cover_url ? upgradeCoverUrl(cover.cover_url) : null;
  const gradient = pickCuratorGradient(shelf.name, index);
  const hasImage = !!coverUrl;

  const shelfNo = `Shelf ${String(index + 1).padStart(2, "0")}`;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "var(--sf)",
        border: "1px solid var(--bd)",
        borderRadius: 12,
        padding: "10px 10px 12px",
        cursor: onClick ? "pointer" : "default",
        transition: "transform var(--duration-fast) var(--easing-default)",
        boxShadow: "var(--shadow-sm)",
        textAlign: "left",
        fontFamily: "inherit",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      onFocus={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onBlur={(e) => (e.currentTarget.style.transform = "")}
    >
      {/* 커버 영역 */}
      <div
        style={{
          width: "100%",
          height: 88,
          borderRadius: "3px 5px 5px 3px",
          marginBottom: 8,
          padding: hasImage ? 0 : "10px 10px 9px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          color: gradient.fg,
          boxShadow:
            "0 2px 4px rgba(30,20,10,0.18), inset 3px 0 0 rgba(0,0,0,0.2), inset -1px 0 0 rgba(255,255,255,0.12)",
          background: hasImage
            ? gradient.from
            : `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
          overflow: "hidden",
        }}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl ?? undefined}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <>
            <div
              style={{
                fontSize: 8,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                opacity: 0.75,
                fontWeight: 700,
              }}
            >
              {shelfNo}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {shelf.name}
            </div>
          </>
        )}
      </div>

      {/* 쉘프 이름 */}
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: "var(--tp)",
          letterSpacing: "-0.01em",
          marginBottom: 3,
          display: "-webkit-box",
          WebkitLineClamp: 1,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {shelf.name}
      </div>

      {/* 권수 · 사유 */}
      <div
        style={{
          fontSize: 10.5,
          color: "var(--ts)",
          lineHeight: 1.45,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--tm)" }}>
          {shelf.books.length}권
        </span>
        <span style={{ margin: "0 4px", color: "var(--tm)" }}>·</span>
        {shelf.reason}
      </div>
    </button>
  );
}

/* ─── ReadingNowCard: 지금 읽는 중 curated 스타일 ─── */
function ReadingNowCard({ book }: { book: Book }) {
  const progress =
    book.total_pages && book.current_page
      ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100))
      : null;
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/book/${book.id}`)}
      style={{
        display: "block",
        textAlign: "left",
        background: "var(--sf)",
        border: "1px solid var(--bd)",
        borderRadius: 14,
        padding: 14,
        marginBottom: 6,
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
        width: "100%",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
          gap: 8,
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
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {book.title}
          {book.author ? ` · ${book.author}` : ""}
        </h4>
        <span
          style={{
            fontSize: 10,
            color: "var(--tm)",
            letterSpacing: "0.04em",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          {book.current_page ? `p.${book.current_page}` : "시작 전"}
          {progress !== null ? ` · ${progress}%` : ""}
        </span>
      </div>
      {book.one_liner && (
        <div
          style={{
            fontSize: 11,
            color: "var(--ts)",
            lineHeight: 1.55,
            marginBottom: 10,
            paddingLeft: 9,
            borderLeft: "2px solid var(--ac3)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          어제 덮은 문장: {book.one_liner}
        </div>
      )}
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
        {/* 장 구성: weeks_data가 있으면 그걸, 없으면 title fallback */}
        {(book.group_books?.weeks_data ?? []).slice(0, 5).map((w) => (
          <BookSpine
            key={w.week}
            title={w.title}
            compact
            heightHint={pickHeight(w.title)}
          />
        ))}
        {!book.group_books?.weeks_data && (
          <>
            <BookSpine title={book.title} compact heightHint="mid" />
            {book.author && (
              <BookSpine title={book.author} compact heightHint="short" />
            )}
          </>
        )}
      </div>
    </button>
  );
}

/* ─── 유틸 ─────────── */
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
