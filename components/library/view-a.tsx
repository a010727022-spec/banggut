"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X as XIcon,
} from "lucide-react";
import type { Book } from "@/lib/types";
import { upgradeCoverUrl } from "@/lib/reading-utils";
import {
  useLibraryViewStore,
  type ShelfMode,
  type LibraryTab,
  type DoneYearFilter,
} from "@/stores/useLibraryViewStore";
import { CoverShelfRow, ShelfWood } from "./primitives";

/* ═══════════════════════════════════════════════
   LibraryViewA — 탭 기반 서재
   상단: 지금 읽는 중 (featured)
   중단: 3 내장 탭 (읽는 중 · 완독 · 위시) + 사용자 큐레이션 쉘프들 + [+]
   하단: 선택 탭에 해당하는 책을 큰 표지/책등으로 선반 위에
   ───────────────────────────────────────────────
   · 완독은 '올해 · 전체' 칩으로 기간 필터
   · 사용자 쉘프는 이름·책 편집·삭제 가능
   · 스크랩 탭은 제거됐어요 (/scrap 페이지에서 별도 관리)
   ═══════════════════════════════════════════════ */

export function LibraryViewA({
  reading,
  finishedThisYear,
  allFinishedCount,
  allFinishedBooks,
  wishBooks,
  borrowedBooks,
}: {
  reading: Book[];
  finishedThisYear: Book[];
  allFinishedCount: number;
  wishBooks: Book[];
  borrowedBooks: Book[];
  /** 뷰 A 에서는 큐레이션 쉘프 카드 스택이 탭 picker 로 대체돼 더 이상 쓰지 않아요. */
  curatedShelves?: { name: string; reason: string; books: Book[] }[];
  allFinishedBooks: Book[];
}) {
  const router = useRouter();
  const shelfMode = useLibraryViewStore((s) => s.shelfMode);
  const setShelfMode = useLibraryViewStore((s) => s.setShelfMode);
  const tab = useLibraryViewStore((s) => s.tab);
  const setTab = useLibraryViewStore((s) => s.setTab);
  const doneFilter = useLibraryViewStore((s) => s.doneYearFilter);
  const setDoneFilter = useLibraryViewStore((s) => s.setDoneYearFilter);
  const customShelves = useLibraryViewStore((s) => s.customShelves);
  const createCustomShelf = useLibraryViewStore((s) => s.createCustomShelf);
  const renameCustomShelf = useLibraryViewStore((s) => s.renameCustomShelf);
  const deleteCustomShelf = useLibraryViewStore((s) => s.deleteCustomShelf);
  const toggleBookInCustomShelf = useLibraryViewStore(
    (s) => s.toggleBookInCustomShelf
  );

  // 시트 열림 상태 — id 만 저장해서 store 업데이트가 시트에도 즉시 반영되게
  const [createOpen, setCreateOpen] = useState(false);
  const [pickerShelfId, setPickerShelfId] = useState<string | null>(null);
  const [editShelfId, setEditShelfId] = useState<string | null>(null);

  const activeCustom = useMemo(
    () => customShelves.find((sh) => sh.id === tab) ?? null,
    [customShelves, tab]
  );
  const pickerShelf = useMemo(
    () =>
      pickerShelfId
        ? customShelves.find((sh) => sh.id === pickerShelfId) ?? null
        : null,
    [customShelves, pickerShelfId]
  );
  const editShelf = useMemo(
    () =>
      editShelfId
        ? customShelves.find((sh) => sh.id === editShelfId) ?? null
        : null,
    [customShelves, editShelfId]
  );

  // 쉘프가 삭제됐는데 시트가 열려 있으면 자동으로 닫기
  useEffect(() => {
    if (pickerShelfId && !pickerShelf) setPickerShelfId(null);
  }, [pickerShelfId, pickerShelf]);
  useEffect(() => {
    if (editShelfId && !editShelf) setEditShelfId(null);
  }, [editShelfId, editShelf]);

  // 완독 탭의 실제 표시 리스트 — 필터칩에 따라 올해/전체
  const doneBooks = doneFilter === "year" ? finishedThisYear : allFinishedBooks;

  // 장르 통계 — 완독 책에서 집계 (상위 5개)
  const genreStats = useMemo(
    () => computeGenreStats(allFinishedBooks),
    [allFinishedBooks]
  );

  // 서재 전체 책 (피커/커스텀 쉘프 조회에 쓰는 book-by-id 맵 소스)
  const allLibraryBooks = useMemo(
    () => dedupeBooksById([...reading, ...allFinishedBooks, ...wishBooks]),
    [reading, allFinishedBooks, wishBooks]
  );
  const bookById = useMemo(() => {
    const m = new Map<string, Book>();
    for (const b of allLibraryBooks) m.set(b.id, b);
    return m;
  }, [allLibraryBooks]);

  // 현재 커스텀 쉘프의 책 리스트 (bookIds → Book[], 누락된 id 필터)
  const customBooks = useMemo(() => {
    if (!activeCustom) return [];
    return activeCustom.bookIds
      .map((id) => bookById.get(id))
      .filter((b): b is Book => !!b);
  }, [activeCustom, bookById]);

  // 탭별 카운트
  const counts: Record<string, number> = {
    reading: reading.length,
    done: allFinishedCount,
    wish: wishBooks.length,
  };
  for (const sh of customShelves) counts[sh.id] = sh.bookIds.length;

  // 내장 탭 3개 + 사용자 쉘프들 — 아이콘은 의도적으로 생략 (일관성)
  const TABS: { id: LibraryTab; label: string }[] = [
    { id: "reading", label: "읽는 중" },
    { id: "done", label: "완독" },
    { id: "wish", label: "위시" },
    ...customShelves.map((sh) => ({ id: sh.id, label: sh.name })),
  ];

  return (
    <div>
      {/* ─── 내 독서 취향 — 장르 통계 (완독 2권+일 때만) ─── */}
      {genreStats.total >= 2 && <GenreStatsCard stats={genreStats} />}

      {/* ─── 탭 picker (사용자 쉘프 포함) + [+] ─── */}
      <ShelfTabs
        tabs={TABS}
        counts={counts}
        active={tab}
        onChange={setTab}
        onAddShelf={() => setCreateOpen(true)}
      />

      {/* ─── 탭별 서브 컨트롤 한 줄 ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "10px 0 6px",
          padding: "0 2px",
          minHeight: 28,
          gap: 8,
        }}
      >
        {/* 왼쪽: 완독 칩 OR 커스텀 쉘프 편집 버튼 OR 빈자리 */}
        {tab === "done" ? (
          <YearChip value={doneFilter} onChange={setDoneFilter} />
        ) : activeCustom ? (
          <CustomShelfActions
            onEditBooks={() => setPickerShelfId(activeCustom.id)}
            onEditInfo={() => setEditShelfId(activeCustom.id)}
          />
        ) : (
          <span aria-hidden />
        )}

        {/* 오른쪽: 진열 모드 슬라이딩 토글 (모든 책 탭에 공통) */}
        <ShelfModeToggle value={shelfMode} onChange={setShelfMode} />
      </div>

      {/* ─── 탭 컨텐츠 ─── */}
      {tab === "reading" && (
        <BookShelfPane
          books={reading}
          shelfMode={shelfMode}
          onBookClick={(id) => router.push(`/book/${id}`)}
          emptyMessage="아직 읽는 중인 책이 없어요."
        />
      )}
      {tab === "done" && (
        <BookShelfPane
          books={doneBooks}
          shelfMode={shelfMode}
          onBookClick={(id) => router.push(`/book/${id}`)}
          emptyMessage={
            doneFilter === "year"
              ? "올해 끝까지 읽은 책이 아직 없어요."
              : "아직 완독한 책이 없어요."
          }
        />
      )}
      {tab === "wish" && (
        <BookShelfPane
          books={wishBooks}
          shelfMode={shelfMode}
          onBookClick={(id) => router.push(`/book/${id}`)}
          emptyMessage="위시에 담긴 책이 아직 없어요."
        />
      )}
      {activeCustom && (
        <BookShelfPane
          books={customBooks}
          shelfMode={shelfMode}
          onBookClick={(id) => router.push(`/book/${id}`)}
          emptyMessage={`'${activeCustom.name}' 쉘프에 담긴 책이 아직 없어요.`}
          emptyCta={{
            label: "책 담기",
            onClick: () => setPickerShelfId(activeCustom.id),
          }}
        />
      )}

      {/* ─── 대여 중 힌트 ─── */}
      {borrowedBooks.length > 0 && <BorrowedHint borrowed={borrowedBooks} />}

      {/* ─── 쉘프 만들기 시트 ─── */}
      {createOpen && (
        <CreateShelfSheet
          onCancel={() => setCreateOpen(false)}
          onCreate={(name) => {
            const id = createCustomShelf(name);
            setTab(id);
            setCreateOpen(false);
            // 생성 직후 자동으로 책 담기 시트 열기
            setPickerShelfId(id);
          }}
        />
      )}

      {/* ─── 책 담기 시트 ─── */}
      {pickerShelf && (
        <BookPickerSheet
          shelfName={pickerShelf.name}
          allBooks={allLibraryBooks}
          selectedIds={pickerShelf.bookIds}
          onToggle={(bookId) =>
            toggleBookInCustomShelf(pickerShelf.id, bookId)
          }
          onClose={() => setPickerShelfId(null)}
        />
      )}

      {/* ─── 쉘프 편집 시트 (이름 바꾸기 · 삭제) ─── */}
      {editShelf && (
        <EditShelfSheet
          shelf={editShelf}
          onRename={(name) => {
            renameCustomShelf(editShelf.id, name);
            setEditShelfId(null);
          }}
          onDelete={() => {
            deleteCustomShelf(editShelf.id);
            setEditShelfId(null);
          }}
          onClose={() => setEditShelfId(null)}
        />
      )}
    </div>
  );
}

/* ═══ GenreStatsCard — 내 독서 취향 ═══
 * 완독 책들의 장르를 집계해 상위 5개를 가로 막대로 보여줘요.
 * Emily 제안: '장르별 통계' 대신 '내 독서 취향' — 데이터 단어 대신 정체성.
 * 완독이 2권 미만일 때는 부모에서 렌더하지 않아요 (의미 없는 카드).
 */
type GenreStats = {
  total: number;
  top: { name: string; count: number; percent: number }[];
};

function computeGenreStats(books: Book[]): GenreStats {
  const counts = new Map<string, number>();
  for (const b of books) {
    const g = (b.genre ?? "").trim();
    if (!g) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const total = books.length;
  if (total === 0 || counts.size === 0) return { total: 0, top: [] };

  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100),
    }));
  return { total, top };
}

function GenreStatsCard({ stats }: { stats: GenreStats }) {
  if (stats.top.length === 0) return null;
  const maxCount = Math.max(...stats.top.map((g) => g.count));

  return (
    <section
      aria-label="내 독서 취향"
      style={{
        margin: "14px -2px 4px",
        padding: "14px 14px 12px",
        borderRadius: 14,
        background:
          "linear-gradient(160deg, color-mix(in srgb, var(--ac) 8%, var(--sf)), var(--sf))",
        border: "0.5px solid color-mix(in srgb, var(--ac) 22%, var(--bd))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--tp)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          내 독서 취향
        </h2>
        <span
          style={{
            fontSize: 10.5,
            color: "var(--tm)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
          }}
        >
          완독 {stats.total}권 기준
        </span>
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {stats.top.map((g) => {
          const barWidth = Math.max(6, Math.round((g.count / maxCount) * 100));
          return (
            <li
              key={g.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  flex: "0 0 auto",
                  minWidth: 52,
                  maxWidth: 84,
                  color: "var(--tp)",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {g.name}
              </span>
              <span
                style={{
                  flex: 1,
                  height: 6,
                  background: "color-mix(in srgb, var(--ac) 10%, var(--sf2))",
                  borderRadius: 3,
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${barWidth}%`,
                    background:
                      "linear-gradient(90deg, var(--ac), var(--ac2))",
                    borderRadius: 3,
                    transition:
                      "width var(--duration-slow) var(--easing-default)",
                  }}
                />
              </span>
              <span
                style={{
                  flex: "0 0 auto",
                  minWidth: 52,
                  textAlign: "right",
                  color: "var(--ts)",
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 11,
                  letterSpacing: "-0.01em",
                }}
              >
                <b style={{ color: "var(--tp)", fontWeight: 700 }}>{g.count}</b>
                <span aria-hidden style={{ opacity: 0.5, margin: "0 3px" }}>
                  ·
                </span>
                {g.percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ═══ BookShelfPane — 탭 본문: 표지/책등 + 선반 ═══
 * 책이 하나도 없을 때 빈 선반만 보여 주는 게 "서재가 아직 준비 중"
 * 이라는 힌트가 돼서 유지해요.
 */
function BookShelfPane({
  books,
  shelfMode,
  onBookClick,
  emptyMessage,
  emptyCta,
}: {
  books: Book[];
  shelfMode: ShelfMode;
  onBookClick?: (bookId: string) => void;
  emptyMessage: string;
  /** 빈 상태에 CTA가 필요하면 전달 — 커스텀 쉘프에서 책 담기 유도용 */
  emptyCta?: { label: string; onClick: () => void };
}) {
  if (books.length === 0) {
    // 진짜 책장처럼 크기 유지 — 책이 있을 때와 같은 최소 높이(150)를
    // 확보하고 가운데에 빈 메시지 + CTA 를 띄운 뒤 바닥 선반을 깔아요.
    return (
      <div style={{ margin: "0 -2px", padding: "4px 2px 0" }}>
        <div
          style={{
            minHeight: 150,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px",
            textAlign: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--ts)",
              lineHeight: 1.5,
            }}
          >
            {emptyMessage}
          </div>
          {emptyCta && (
            <button
              type="button"
              onClick={emptyCta.onClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "8px 16px",
                borderRadius: 999,
                background: "var(--ac)",
                color: "var(--acc)",
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                minHeight: 32,
                letterSpacing: "-0.01em",
              }}
            >
              <Plus size={12} strokeWidth={2.5} />
              {emptyCta.label}
            </button>
          )}
        </div>
        <ShelfWood stretch />
      </div>
    );
  }

  if (shelfMode === "cover") {
    return (
      <CoverShelfRow
        books={books}
        size="large"
        upgradeCoverUrl={upgradeCoverUrl}
        onBookClick={onBookClick}
      />
    );
  }

  // 책등 모드 — 선반 위에 세로 책등이 빽빽하게, 넘치면 아래로 단이 생겨요.
  const SPINES_PER_ROW = 7;
  const spineRows: Book[][] = [];
  for (let i = 0; i < books.length; i += SPINES_PER_ROW) {
    spineRows.push(books.slice(i, i + SPINES_PER_ROW));
  }

  return (
    <div style={{ margin: "0 -2px", padding: "4px 2px 0" }}>
      {spineRows.map((rowBooks, idx) => (
        <div key={idx} style={{ marginTop: idx === 0 ? 0 : 8 }}>
          <div
            style={{
              display: "flex",
              gap: 3,
              alignItems: "flex-end",
              minHeight: 150,
            }}
          >
            {rowBooks.map((b) => (
              <BookSpineLarge
                key={b.id}
                title={b.title}
                coverUrl={upgradeCoverUrl(b.cover_url)}
                onClick={onBookClick ? () => onBookClick(b.id) : undefined}
              />
            ))}
          </div>
          <ShelfWood stretch />
        </div>
      ))}
    </div>
  );
}

/* 큰 책등 — 큰 표지 모드와 선반 높이가 맞도록 살짝 키운 버전 */
function BookSpineLarge({
  title,
  coverUrl,
  onClick,
}: {
  title: string;
  coverUrl?: string | null;
  onClick?: () => void;
}) {
  const h = 128 + (hashString(title) % 5) * 4;
  const hasImage = !!coverUrl;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title} 상세 보기`}
      style={{
        width: 40,
        minWidth: 40,
        height: h,
        position: "relative",
        cursor: onClick ? "pointer" : "default",
        borderRadius: "1.5px 1.5px 0 0",
        background: hasImage ? "#2a2a2a" : "var(--ac)",
        color: hasImage ? "#fff" : "var(--acc)",
        boxShadow: [
          "inset 0 -2px 3px rgba(0,0,0,0.2)",
          "inset 1.5px 0 0 rgba(255,255,255,0.15)",
          "inset -1px 0 0 rgba(0,0,0,0.22)",
          "0 5px 6px -3px rgba(40,25,10,0.35)",
          "0 2px 3px -1px rgba(40,25,10,0.2)",
        ].join(", "),
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
        padding: 0,
        border: "none",
        fontFamily: "inherit",
      }}
    >
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl ?? undefined}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      )}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: hasImage
            ? "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.82) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.15) 100%)",
          pointerEvents: "none",
        }}
      />
      <span
        style={{
          position: "relative",
          writingMode: "vertical-rl",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          padding: "10px 0 12px",
          maxHeight: "100%",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          textShadow: hasImage
            ? "0 1px 2px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,0.6)"
            : "none",
          lineHeight: 1,
        }}
      >
        {title}
      </span>
    </button>
  );
}

/* ═══ ShelfTabs — 내장 2탭 + 커스텀 쉘프 + [+] ═══
 * 탭이 많아져 가로 스크롤이 생겨도 + 버튼이 항상 오른쪽 끝에 보이도록
 * 스크롤 영역과 + 를 같은 flex row 의 형제로 분리했어요.
 * 활성 탭이 바뀔 때 자동으로 뷰포트 안쪽으로 스크롤해 이름이 짤리지 않게 해요.
 */
function ShelfTabs({
  tabs,
  counts,
  active,
  onChange,
  onAddShelf,
}: {
  tabs: { id: LibraryTab; label: string }[];
  counts: Record<string, number>;
  active: LibraryTab;
  onChange: (tab: LibraryTab) => void;
  onAddShelf: () => void;
}) {
  // 활성 탭이 바뀌면 스크롤 영역 안쪽으로 살살 끌어와요 — 잘린 텍스트가 보이지 않도록.
  const tablistRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = tablistRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-tab-id="${active}"]`);
    if (!el) return;
    // inline: "nearest" 이면 필요한 만큼만 스크롤 (이미 보이면 그대로)
    el.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [active, tabs.length]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        borderBottom: "0.5px solid var(--bd)",
        margin: "18px -2px 0",
        padding: "0 2px",
        position: "relative",
      }}
    >
      {/* 스크롤 가능한 탭 스트립 — + 버튼과 분리되어 언제나 오른쪽 끝에 고정 */}
      <div
        ref={tablistRef}
        className="scrollbar-hide"
        role="tablist"
        aria-label="서재 쉘프 선택"
        style={{
          flex: 1,
          display: "flex",
          gap: 18,
          overflowX: "auto",
          minWidth: 0, // flex child 가 shrink 할 수 있도록
          // 오른쪽 끝 텍스트가 + 버튼에 너무 달라붙지 않게 여유 공간을 남겨요.
          paddingRight: 6,
          // fade mask 는 제거 — 활성 탭 텍스트를 가리는 부작용이 더 컸어요.
          // 대신 scrollIntoView 로 활성 탭이 항상 완전히 보이도록 보장해요.
        }}
      >
        {tabs.map((t) => {
          const on = active === t.id;
          const c = counts[t.id] ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              data-tab-id={t.id}
              onClick={() => onChange(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "12px 4px",
                fontSize: 14,
                fontWeight: on ? 700 : 500,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                cursor: "pointer",
                border: "none",
                background: "transparent",
                color: on ? "var(--tp)" : "var(--tm)",
                transition: "color 0.25s",
                fontFamily: "inherit",
                userSelect: "none",
                position: "relative",
                flexShrink: 0,
                minHeight: 44,
              }}
            >
              {t.label}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 100,
                  padding: "2px 7px",
                  minWidth: 18,
                  textAlign: "center",
                  background: on
                    ? "color-mix(in srgb, var(--ac) 15%, transparent)"
                    : "var(--sf2)",
                  color: on ? "var(--ac)" : "var(--tm)",
                  transition: "all 0.2s",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {c}
              </span>
              {/* 언더라인 인디케이터 */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  bottom: -0.5,
                  left: 0,
                  right: 0,
                  height: 2.5,
                  background: on
                    ? "linear-gradient(90deg, var(--ac), var(--ac2))"
                    : "transparent",
                  borderRadius: 2,
                  boxShadow: on
                    ? "0 2px 8px color-mix(in srgb, var(--ac) 40%, transparent)"
                    : "none",
                  transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* + 새 쉘프 버튼 — 스크롤 바깥, 오른쪽 끝 고정 */}
      <button
        type="button"
        onClick={onAddShelf}
        aria-label="새 쉘프 만들기"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: 10,
          paddingRight: 4,
          minHeight: 44,
          flexShrink: 0,
          cursor: "pointer",
          border: "none",
          background: "var(--bg)", // 스크롤되는 탭이 뒤로 비치지 않게 배경색으로 덮기
          color: "var(--tm)",
          transition: "color 0.2s",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget.firstChild as HTMLElement).style.borderColor =
            "var(--ac)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget.firstChild as HTMLElement).style.borderColor =
            "color-mix(in srgb, var(--ac) 50%, var(--bd2))")
        }
      >
        <span
          aria-hidden
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "1.5px dashed color-mix(in srgb, var(--ac) 50%, var(--bd2))",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            transition: "all 0.2s",
          }}
        >
          <Plus size={13} strokeWidth={2.5} color="var(--ac)" />
        </span>
      </button>
    </div>
  );
}

/* ═══ YearChip — 완독 탭의 올해/전체 필터 ═══ */
function YearChip({
  value,
  onChange,
}: {
  value: DoneYearFilter;
  onChange: (v: DoneYearFilter) => void;
}) {
  const year = new Date().getFullYear();
  const options: { value: DoneYearFilter; label: string }[] = [
    { value: "year", label: `${year}년` },
    { value: "all", label: "전체" },
  ];
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      role="tablist"
      aria-label="완독 기간 필터"
      style={{
        position: "relative",
        display: "inline-flex",
        padding: 2,
        background: "var(--sf2)",
        border: "0.5px solid var(--bd)",
        borderRadius: 999,
        minHeight: 28,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          bottom: 2,
          left: 2,
          width: "calc(50% - 2px)",
          borderRadius: 999,
          background: "var(--ac)",
          transform: `translateX(${activeIndex * 100}%)`,
          transition: "transform var(--duration-default) var(--easing-default)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.14)",
        }}
      />
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt.value)}
            style={{
              position: "relative",
              zIndex: 1,
              minWidth: 48,
              minHeight: 24,
              padding: "4px 12px",
              borderRadius: 999,
              border: "none",
              background: "transparent",
              color: on ? "var(--acc)" : "var(--ts)",
              fontWeight: on ? 700 : 500,
              fontSize: 11,
              letterSpacing: "-0.01em",
              cursor: "pointer",
              fontFamily: "inherit",
              fontVariantNumeric: "tabular-nums",
              transition: "color var(--duration-default) var(--easing-default)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══ CustomShelfActions — 사용자 쉘프 전용 액션 (책 편집 · 쉘프 수정) ═══ */
function CustomShelfActions({
  onEditBooks,
  onEditInfo,
}: {
  onEditBooks: () => void;
  onEditInfo: () => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 6 }}>
      <button
        type="button"
        onClick={onEditBooks}
        aria-label="쉘프에 책 편집"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 10px",
          borderRadius: 999,
          border: "0.5px solid color-mix(in srgb, var(--ac) 40%, var(--bd))",
          background: "color-mix(in srgb, var(--ac) 10%, transparent)",
          color: "var(--ac)",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
          minHeight: 28,
          letterSpacing: "-0.01em",
        }}
      >
        <Plus size={11} strokeWidth={2.8} />책 편집
      </button>
      <button
        type="button"
        onClick={onEditInfo}
        aria-label="쉘프 정보 수정"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          padding: 0,
          borderRadius: 999,
          border: "0.5px solid var(--bd)",
          background: "var(--sf2)",
          color: "var(--tm)",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Pencil size={12} strokeWidth={2.2} />
      </button>
    </div>
  );
}

/* ═══ ShelfModeToggle — 표지 ↔ 책등 ═══ */
function ShelfModeToggle({
  value,
  onChange,
}: {
  value: ShelfMode;
  onChange: (mode: ShelfMode) => void;
}) {
  const options: { value: ShelfMode; label: string }[] = [
    { value: "cover", label: "표지" },
    { value: "spine", label: "책등" },
  ];
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      role="tablist"
      aria-label="진열 모드"
      style={{
        position: "relative",
        display: "inline-flex",
        padding: 2,
        background: "var(--sf2)",
        border: "0.5px solid var(--bd)",
        borderRadius: 999,
        minHeight: 28,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          bottom: 2,
          left: 2,
          width: "calc(50% - 2px)",
          borderRadius: 999,
          background: "var(--ac)",
          transform: `translateX(${activeIndex * 100}%)`,
          transition: "transform var(--duration-default) var(--easing-default)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.14)",
        }}
      />
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt.value)}
            style={{
              position: "relative",
              zIndex: 1,
              minWidth: 40,
              minHeight: 24,
              padding: "4px 11px",
              borderRadius: 999,
              border: "none",
              background: "transparent",
              color: on ? "var(--acc)" : "var(--ts)",
              fontWeight: on ? 700 : 500,
              fontSize: 11,
              letterSpacing: "-0.01em",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "color var(--duration-default) var(--easing-default)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══ SheetShell — 바텀시트 공통 껍데기 ═══
 * 백드롭 + 하단에서 올라오는 흰 패널. Escape/바깥 탭으로 닫기 지원.
 */
function SheetShell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // Escape 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // 바디 스크롤 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(30, 25, 18, 0.45)",
        animation: "sheet-fade-in 0.2s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg)",
          width: "100%",
          maxWidth: 460,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh",
          animation: "sheet-slide-up 0.25s cubic-bezier(0.22,1,0.36,1)",
          boxShadow: "0 -12px 30px rgba(40,25,10,0.18)",
        }}
      >
        {/* 드래그 핸들 */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "var(--bd2)",
            margin: "8px auto 4px",
          }}
        />
        {/* 헤더 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 18px 10px",
            borderBottom: "0.5px solid var(--bd)",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--tp)",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              padding: 0,
              border: "none",
              background: "transparent",
              color: "var(--tm)",
              cursor: "pointer",
              borderRadius: 999,
              fontFamily: "inherit",
            }}
          >
            <XIcon size={16} strokeWidth={2.2} />
          </button>
        </div>
        {/* 바디 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 18px 4px",
            minHeight: 60,
          }}
        >
          {children}
        </div>
        {/* 푸터 */}
        {footer && (
          <div
            style={{
              padding: "10px 18px 16px",
              borderTop: "0.5px solid var(--bd)",
              background: "var(--sf)",
              display: "flex",
              gap: 8,
            }}
          >
            {footer}
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes sheet-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes sheet-slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

/* ═══ CreateShelfSheet — 새 쉘프 이름 입력 ═══ */
function CreateShelfSheet({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 30;

  return (
    <SheetShell
      title="새 쉘프 만들기"
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            style={buttonStyle("ghost")}
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => canSubmit && onCreate(trimmed)}
            style={{
              ...buttonStyle("primary"),
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            만들기
          </button>
        </>
      }
    >
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--tm)",
          letterSpacing: "0.04em",
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        쉘프 이름
      </label>
      <input
        type="text"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canSubmit) onCreate(trimmed);
        }}
        placeholder="예: 인생책, 취미, 빨리 읽기"
        maxLength={30}
        style={inputStyle()}
      />
      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "var(--ts)",
          lineHeight: 1.5,
        }}
      >
        만든 뒤에 바로 책을 담을 수 있어요. 나중에 언제든 이름을 바꾸거나 지울
        수 있어요.
      </div>
    </SheetShell>
  );
}

/* ═══ BookPickerSheet — 책 체크리스트 ═══ */
function BookPickerSheet({
  shelfName,
  allBooks,
  selectedIds,
  onToggle,
  onClose,
}: {
  shelfName: string;
  allBooks: Book[];
  selectedIds: string[];
  onToggle: (bookId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allBooks;
    return allBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.author ?? "").toLowerCase().includes(q)
    );
  }, [query, allBooks]);

  return (
    <SheetShell
      title={`'${shelfName}' 에 담을 책`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          style={{ ...buttonStyle("primary"), flex: 1 }}
        >
          완료 · {selectedSet.size}권 선택됨
        </button>
      }
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="책 제목이나 저자 검색"
        style={{ ...inputStyle(), marginBottom: 10 }}
      />
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "20px 16px",
            textAlign: "center",
            color: "var(--ts)",
            fontSize: 12,
            background: "var(--sf2)",
            borderRadius: 10,
          }}
        >
          서재에 담긴 책이 없거나 검색 결과가 없어요.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map((b) => {
            const on = selectedSet.has(b.id);
            const cover = upgradeCoverUrl(b.cover_url);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onToggle(b.id)}
                aria-pressed={on}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 6px",
                  border: "none",
                  background: on
                    ? "color-mix(in srgb, var(--ac) 10%, transparent)"
                    : "transparent",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  width: "100%",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 52,
                    flexShrink: 0,
                    borderRadius: 3,
                    overflow: "hidden",
                    background: "var(--sf2)",
                    position: "relative",
                    boxShadow: "0 1px 3px rgba(40,25,10,0.14)",
                  }}
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                        color: "var(--tm)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {b.title.slice(0, 4)}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--tp)",
                      letterSpacing: "-0.01em",
                      lineHeight: 1.3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {b.title}
                  </div>
                  {b.author && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--tm)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.author}
                    </div>
                  )}
                </div>
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: on ? "var(--ac)" : "transparent",
                    border: on
                      ? "1.5px solid var(--ac)"
                      : "1.5px solid var(--bd2)",
                    color: on ? "var(--acc)" : "transparent",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </SheetShell>
  );
}

/* ═══ EditShelfSheet — 이름 바꾸기 · 삭제 ═══ */
function EditShelfSheet({
  shelf,
  onRename,
  onDelete,
  onClose,
}: {
  shelf: { id: string; name: string; bookIds: string[] };
  onRename: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(shelf.name);
  const [confirming, setConfirming] = useState(false);
  const trimmed = name.trim();
  const canRename = trimmed.length > 0 && trimmed.length <= 30 && trimmed !== shelf.name;

  return (
    <SheetShell
      title="쉘프 수정"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={buttonStyle("ghost")}
          >
            닫기
          </button>
          <button
            type="button"
            disabled={!canRename}
            onClick={() => canRename && onRename(trimmed)}
            style={{
              ...buttonStyle("primary"),
              opacity: canRename ? 1 : 0.5,
              cursor: canRename ? "pointer" : "not-allowed",
            }}
          >
            이름 저장
          </button>
        </>
      }
    >
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--tm)",
          letterSpacing: "0.04em",
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        쉘프 이름
      </label>
      <input
        type="text"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        style={inputStyle()}
      />

      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: "0.5px dashed var(--bd2)",
        }}
      >
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 999,
              border: "0.5px solid color-mix(in srgb, #d9534f 40%, var(--bd))",
              background: "color-mix(in srgb, #d9534f 8%, transparent)",
              color: "#c44941",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              minHeight: 32,
            }}
          >
            <Trash2 size={12} strokeWidth={2.2} />쉘프 삭제
          </button>
        ) : (
          <div
            style={{
              background: "color-mix(in srgb, #d9534f 6%, transparent)",
              border: "0.5px solid color-mix(in srgb, #d9534f 30%, var(--bd))",
              borderRadius: 10,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "var(--tp)",
                lineHeight: 1.5,
              }}
            >
              '<b>{shelf.name}</b>' 쉘프를 삭제하면 복구할 수 없어요. 담긴
              책들은 서재에서 사라지지 않아요.
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                style={{ ...buttonStyle("ghost"), minHeight: 30, padding: "6px 12px" }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={onDelete}
                style={{
                  ...buttonStyle("primary"),
                  background: "#c44941",
                  minHeight: 30,
                  padding: "6px 12px",
                }}
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </div>
    </SheetShell>
  );
}

/* ═══ BorrowedHint — 하단 대여 중 힌트 (한 줄 짜리) ═══ */
function BorrowedHint({ borrowed }: { borrowed: Book[] }) {
  const upcoming = borrowed
    .filter((b) => b.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];
  const due = upcoming?.due_date ? formatDate(upcoming.due_date) : null;

  return (
    <div
      style={{
        marginTop: 16,
        padding: "10px 12px",
        borderRadius: 12,
        background: "var(--sf2)",
        border: "0.5px solid var(--bd)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 11.5,
        color: "var(--ts)",
        lineHeight: 1.4,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--ac)",
        }}
      >
        대여 중 {borrowed.length}권
      </span>
      <span style={{ color: "var(--tm)" }}>·</span>
      <span>
        {due ? `가장 가까운 반납 ${due}` : borrowed[0]?.title ?? "대여한 책"}
      </span>
    </div>
  );
}

/* ─── 유틸 ─────────── */
function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko", {
    month: "long",
    day: "numeric",
  });
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function dedupeBooksById(books: Book[]): Book[] {
  const seen = new Set<string>();
  const out: Book[] = [];
  for (const b of books) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
  }
  return out;
}

/* ─── 버튼 스타일 프리셋 (시트 공통) ─── */
function buttonStyle(variant: "primary" | "ghost"): React.CSSProperties {
  if (variant === "primary") {
    return {
      flex: 1,
      padding: "10px 14px",
      minHeight: 40,
      borderRadius: 12,
      border: "none",
      background: "var(--ac)",
      color: "var(--acc)",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
      letterSpacing: "-0.01em",
    };
  }
  return {
    flex: 1,
    padding: "10px 14px",
    minHeight: 40,
    borderRadius: 12,
    border: "0.5px solid var(--bd)",
    background: "var(--sf2)",
    color: "var(--tm)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "0.5px solid var(--bd)",
    background: "var(--sf)",
    color: "var(--tp)",
    fontSize: 14,
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
    outline: "none",
    boxShadow: "inset 0 1px 2px rgba(40,25,10,0.04)",
  };
}
