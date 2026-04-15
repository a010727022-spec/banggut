"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, BookOpen, Bookmark, PenLine, Clock, AlertTriangle, RefreshCw, ArrowUpDown } from "lucide-react";
import AppHeader from "@/components/shared/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
// date-fns format moved to AppHeader
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { getBooks, getAllStreakDates, getScraps } from "@/lib/supabase/queries";
import type { Scrap } from "@/lib/types";
// getAvatarSrc moved to AppHeader
import type { Book } from "@/lib/types";

type LibraryTab = "reading" | "done" | "wish" | "scrap";

/* ═══ 유틸 ═══ */
function getProgress(b: Book): number {
  if (b.format === "ebook") return b.progress_percent || 0;
  if (b.total_pages && b.current_page) return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
  if (b.reading_status === "finished") return 100;
  return 0;
}
function upgradeCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace("/cover/", "/cover500/").replace("/cover200/", "/cover500/").replace("/coversum/", "/cover500/").replace("http://", "https://");
}
const COVER_PALETTES = [["#90C4E4","#2B6CB0"],["#7FAF8A","#2B4C3F"],["#C4A35A","#8B6F3C"],["#F0A8C4","#B0557A"],["#94B8B0","#3D6B5A"],["#B8A9D4","#5B4A8A"]];
const coverPalette = (t: string) => COVER_PALETTES[t.charCodeAt(0) % COVER_PALETTES.length];

/* 체온/위젯/Hero 유틸은 components/shared/AppHeader.tsx로 이동 */

/* ═══ 피처 카드 (읽는 중 — HTML .fc) ═══ */
function FeaturedCard({ book }: { book: Book }) {
  const router = useRouter();
  const coverUrl = upgradeCoverUrl(book.cover_url);
  const [bg, fg] = coverPalette(book.title);
  const progress = getProgress(book);
  const groupName = book.group_books?.reading_groups?.name;

  return (
    <div onClick={() => router.push(`/book/${book.id}`)}
      style={{
        margin: "0 20px 12px", background: "var(--sf)",
        borderRadius: 14, border: "0.5px solid var(--bd)",
        overflow: "hidden", cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.22,1,0.36,1), background 0.4s, border-color 0.4s",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
    >
      <div style={{ display: "flex" }}>
        <div style={{ width: 108, flexShrink: 0, minHeight: 160, position: "relative", overflow: "hidden" }}>
          {coverUrl ? (
            <img src={coverUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg, ${bg}, ${fg})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 1.5, fontWeight: 500 }}>{book.title.slice(0, 8).toUpperCase()}</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, padding: "14px 13px 12px", display: "flex", flexDirection: "column" }}>
          {groupName && (
            <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 5, transition: "color 0.4s" }}>{groupName}</div>
          )}
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.4px", lineHeight: 1.25, transition: "color 0.4s", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{book.title}</div>
          {book.author && <div style={{ fontSize: 11, color: "var(--ts)", marginTop: 3, transition: "color 0.4s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.author}</div>}
          {/* 인용문 (HTML .fc-qt) */}
          {book.one_liner && (
            <div style={{
              marginTop: 10, padding: "8px 10px",
              background: "color-mix(in srgb, var(--ac) 8%, transparent)",
              borderRadius: 8, borderLeft: "2px solid var(--ac)",
              transition: "all 0.4s",
            }}>
              <p style={{ fontSize: 10, color: "var(--ts)", lineHeight: 1.7, fontStyle: "italic", transition: "color 0.4s" }}>
                &ldquo;{book.one_liner}&rdquo;
              </p>
            </div>
          )}
          <div style={{ marginTop: "auto", paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", transition: "color 0.4s" }}>진행률</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ac)", transition: "color 0.4s" }}>{progress}%</span>
            </div>
            <div style={{ height: 3, background: "var(--sf3)", borderRadius: 2, overflow: "hidden", transition: "background 0.4s" }}>
              <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, var(--ac), var(--ac2))", width: `${progress}%`, transition: "width 0.5s, background 0.4s" }} />
            </div>
          </div>
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 14px", borderTop: "0.5px solid var(--bd)",
        background: "var(--sf2)", transition: "all 0.4s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <PenLine size={11} color="var(--ts)" strokeWidth={2} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ts)", transition: "color 0.4s" }}>스크랩</span>
          <Clock size={11} color="var(--ts)" strokeWidth={2} style={{ marginLeft: 8 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ts)", transition: "color 0.4s" }}>{book.current_page ? `p.${book.current_page}` : "시작 전"}</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--acc)", background: "var(--ac)", padding: "5px 12px", borderRadius: 100, transition: "all 0.4s" }}>계속 읽기 →</div>
      </div>
    </div>
  );
}

/* ═══ 그리드 타일 (완독 — HTML .btile) ═══ */
function BookTile({ book }: { book: Book }) {
  const router = useRouter();
  const coverUrl = upgradeCoverUrl(book.cover_url);
  const [bg, fg] = coverPalette(book.title);
  return (
    <div onClick={() => router.push(`/book/${book.id}`)}
      style={{ aspectRatio: "2/3", position: "relative", overflow: "hidden", cursor: "pointer", background: "var(--sf2)", transition: "background 0.4s" }}>
      {coverUrl ? (
        <img src={coverUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg, ${bg}, ${fg})` }} />
      )}
      <div style={{
        position: "absolute", inset: 0, padding: "9px 8px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "linear-gradient(to top, rgba(0,0,0,0.88) 30%, rgba(0,0,0,0.06) 65%, transparent)",
      }}>
        <span style={{ alignSelf: "flex-start", fontSize: 8, fontWeight: 800, padding: "3px 7px", borderRadius: 100, background: "color-mix(in srgb, var(--ac) 90%, transparent)", color: "var(--acc)", letterSpacing: "0.6px" }}>완독</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#ede8e0", lineHeight: 1.3, textShadow: "0 1px 6px rgba(0,0,0,0.9)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{book.title}</div>
          {book.author && <div style={{ fontSize: 9, color: "rgba(220,210,200,0.48)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.author}</div>}
        </div>
      </div>
    </div>
  );
}

/* ═══ 위시 아이템 (HTML .wi) ═══ */
function WishItem({ book }: { book: Book }) {
  const router = useRouter();
  const coverUrl = upgradeCoverUrl(book.cover_url);
  const [bg, fg] = coverPalette(book.title);
  return (
    <div onClick={() => router.push(`/book/${book.id}`)}
      style={{
        display: "flex", gap: 13, padding: "12px 20px",
        borderBottom: "0.5px solid var(--bd)", alignItems: "center",
        cursor: "pointer", transition: "background 0.15s, border-color 0.4s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sf)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
    >
      <div style={{ width: 44, height: 64, borderRadius: 7, overflow: "hidden", flexShrink: 0, position: "relative" }}>
        {coverUrl ? (
          <img src={coverUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg, ${bg}, ${fg})` }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tp)", lineHeight: 1.3, transition: "color 0.4s", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{book.title}</div>
        {book.author && <div style={{ fontSize: 11, color: "var(--tm)", marginTop: 2, transition: "color 0.4s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.author}</div>}
        {book.genre && (
          <span style={{ display: "inline-block", marginTop: 6, fontSize: 9, fontWeight: 800, color: "var(--ac)", background: "color-mix(in srgb, var(--ac) 12%, transparent)", padding: "3px 9px", borderRadius: 100, transition: "all 0.4s" }}>{book.genre}</span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   메인
═══════════════════════════════════════════ */
export default function LibraryPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { books, setBooks, setLoading } = useLibraryStore();
  useThemeStore();
  const [tab, setTab] = useState<LibraryTab>("reading");
  const [finishedSort, setFinishedSort] = useState<"recent" | "rating" | "title">("recent");
  const [streakDatesArr, setStreakDatesArr] = useState<string[]>([]);
  const [recentScraps, setRecentScraps] = useState<Scrap[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    setLoadError(false);
    const supabase = createClient();
    Promise.all([
      getBooks(supabase, user.id),
      getAllStreakDates(supabase, user.id),
      getScraps(supabase, user.id, 4),
    ]).then(([booksData, streakData, scrapsData]) => {
      setBooks(booksData);
      setStreakDatesArr(streakData);
      setRecentScraps(scrapsData);
    }).catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  }, [user, setBooks, setLoading, retryCount]);

  const grouped = useMemo(() => {
    const g = { reading: [] as Book[], done: [] as Book[], want: [] as Book[] };
    for (const b of books) {
      if (b.reading_status === "reading") g.reading.push(b);
      else if (b.reading_status === "finished") g.done.push(b);
      else if (b.reading_status === "want_to_read" || b.reading_status === "to_read") g.want.push(b);
    }
    g.reading.sort((a, b) => (b.group_books ? 1 : 0) - (a.group_books ? 1 : 0));
    return g;
  }, [books]);

  const sortedDone = useMemo(() => {
    const list = [...grouped.done];
    switch (finishedSort) {
      case "recent":
        list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case "rating":
        list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "title":
        list.sort((a, b) => a.title.localeCompare(b.title, "ko"));
        break;
    }
    return list;
  }, [grouped.done, finishedSort]);

  const counts = { reading: grouped.reading.length, done: grouped.done.length, want: grouped.want.length };

  const TABS: { id: LibraryTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "reading", label: "읽는 중", icon: <BookOpen size={11} strokeWidth={2.5} />, count: counts.reading },
    { id: "done", label: "완독", count: counts.done, icon: null },
    { id: "wish", label: "위시", count: counts.want, icon: null },
    { id: "scrap", label: "스크랩", icon: <PenLine size={11} strokeWidth={2.5} /> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 100, transition: "background 0.4s" }}>

      {/* ═══ 공통 헤더 (Hero + 프로필 + 체온) ═══ */}
      <AppHeader streakDates={streakDatesArr} counts={counts} />

      {/* ═══ ERROR STATE ═══ */}
      {loadError && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "60px 20px", textAlign: "center",
        }}>
          <AlertTriangle size={40} color="var(--ts)" strokeWidth={1.5} style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tp)", marginBottom: 6 }}>
            서재를 불러올 수 없어요
          </div>
          <div style={{ fontSize: 13, color: "var(--ts)", marginBottom: 20 }}>
            네트워크 연결을 확인해주세요
          </div>
          <button
            onClick={() => { setLoadError(false); setRetryCount((c) => c + 1); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 100,
              background: "var(--ac)", color: "var(--acc)",
              fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
              transition: "opacity 0.2s",
            }}
          >
            <RefreshCw size={14} strokeWidth={2.5} />
            다시 시도
          </button>
        </div>
      )}

      {/* ═══ TABS ═══ */}
      {!loadError && (<div style={{ display: "flex", gap: 6, padding: "12px 20px 8px", overflowX: "auto" }} className="scrollbar-hide">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 14px", borderRadius: 100,
                fontSize: 12, fontWeight: 700, letterSpacing: "0.2px",
                whiteSpace: "nowrap", cursor: "pointer",
                border: "0.5px solid transparent",
                background: on ? "var(--ac)" : "transparent",
                color: on ? "var(--acc)" : "var(--tm)",
                borderColor: on ? "var(--ac)" : "var(--bd2)",
                transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
                fontFamily: "'Pretendard', sans-serif",
                userSelect: "none",
              }}>
              {t.icon}
              {t.label}
              {t.count != null && (
                <span style={{
                  fontSize: 10, fontWeight: 800, borderRadius: 100, padding: "1px 6px", minWidth: 18, textAlign: "center",
                  background: on ? "rgba(0,0,0,0.15)" : "var(--sf2)",
                  color: on ? "var(--acc)" : "var(--tm)",
                  transition: "all 0.2s",
                }}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>)}

      {/* ═══ PANELS ═══ */}
      {!loadError && tab === "reading" && (
        <div style={{ animation: "pageIn 0.22s cubic-bezier(0.22,1,0.36,1)" }}>
          {grouped.reading.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="아직 읽는 책이 없어요"
              description="첫 번째 책을 추가하고 독서 여정을 시작해보세요"
              ctaLabel="책 추가하기"
              onCta={() => router.push("/setup")}
            />
          ) : (
            <>
              <div style={{ padding: "4px 20px 8px", fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", transition: "color 0.4s" }}>지금 읽고 있어요</div>
              {grouped.reading.map((b) => <FeaturedCard key={b.id} book={b} />)}

              {/* 최근 그은 문장 (HTML .hl 카드) */}
              {recentScraps.length > 0 && (
                <>
                  <div style={{ padding: "12px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", transition: "color 0.4s" }}>최근 그은 문장</span>
                    <span onClick={() => router.push("/scrap")} style={{ fontSize: 11, fontWeight: 700, color: "var(--ac)", cursor: "pointer", transition: "color 0.4s" }}>전체 →</span>
                  </div>
                  <div style={{ padding: "4px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {recentScraps.slice(0, 2).map((s) => {
                      const scrapBook = books.find((b) => b.id === s.book_id);
                      return (
                        <div key={s.id}
                          onClick={() => router.push(`/book/${s.book_id}`)}
                          style={{
                            background: "var(--sf)", borderRadius: 14,
                            border: "0.5px solid var(--bd)", padding: "12px 14px",
                            cursor: "pointer", transition: "all 0.2s, background 0.4s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sf2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--sf)")}
                        >
                          <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "0.8px", marginBottom: 6, transition: "color 0.4s" }}>
                            {scrapBook?.title || "책"} {s.page_number ? `· p.${s.page_number}` : ""}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--tp)", lineHeight: 1.7, fontStyle: "italic", transition: "color 0.4s" }}>
                            &ldquo;{s.text}&rdquo;
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                            <span style={{ fontSize: 10, color: "var(--tm)", transition: "color 0.4s" }}>
                              {new Date(s.created_at).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {!loadError && tab === "done" && (
        <div style={{ animation: "pageIn 0.22s cubic-bezier(0.22,1,0.36,1)" }}>
          <div style={{ padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", transition: "color 0.4s" }}>완독 {counts.done}권</span>
            <span
              onClick={() => setFinishedSort((s) => s === "recent" ? "rating" : s === "rating" ? "title" : "recent")}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--ac)", cursor: "pointer", transition: "color 0.4s", userSelect: "none" }}
            >
              {finishedSort === "recent" ? "최신순" : finishedSort === "rating" ? "평점순" : "제목순"}
              <ArrowUpDown size={12} strokeWidth={2.5} />
            </span>
          </div>
          {counts.done === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="아직 완독한 책이 없어요"
              description="한 권을 끝까지 읽으면 완독 서가에 꽂혀요"
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
              {sortedDone.map((b) => <BookTile key={b.id} book={b} />)}
              <div onClick={() => router.push("/setup")}
                style={{
                  aspectRatio: "2/3", background: "transparent",
                  border: "1px dashed color-mix(in srgb, var(--ac) 25%, transparent)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", gap: 7, transition: "all 0.2s",
                }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid color-mix(in srgb, var(--ac) 35%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={14} stroke="var(--ac)" strokeWidth={2.5} style={{ opacity: 0.5 }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, color: "var(--tm)", letterSpacing: "0.8px", textTransform: "uppercase", transition: "color 0.4s" }}>추가</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!loadError && tab === "wish" && (
        <div style={{ animation: "pageIn 0.22s cubic-bezier(0.22,1,0.36,1)", padding: "4px 0" }}>
          {grouped.want.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="위시리스트가 비어있어요"
              description="읽고 싶은 책을 저장해두면 잊지 않고 만날 수 있어요"
              ctaLabel="책 담기"
              onCta={() => router.push("/setup")}
            />
          ) : (
            grouped.want.map((b) => <WishItem key={b.id} book={b} />)
          )}
        </div>
      )}

      {!loadError && tab === "scrap" && (
        <div style={{ animation: "pageIn 0.22s cubic-bezier(0.22,1,0.36,1)" }}>
          <div style={{ padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", letterSpacing: "1.2px", textTransform: "uppercase", transition: "color 0.4s" }}>
              그은 문장 {recentScraps.length}개
            </span>
            <span onClick={() => router.push("/scrap")} style={{ fontSize: 11, fontWeight: 700, color: "var(--ac)", cursor: "pointer" }}>책별 보기</span>
          </div>
          {recentScraps.length === 0 ? (
            <EmptyState
              icon={PenLine}
              title="아직 그은 문장이 없어요"
              description="책을 읽으며 마음에 드는 문장을 스크랩해보세요"
            />
          ) : (
            recentScraps.map((s) => {
              const scrapBook = books.find((b) => b.id === s.book_id);
              return (
                <div key={s.id}
                  onClick={() => router.push(`/book/${s.book_id}`)}
                  style={{
                    display: "flex", gap: 12, padding: "14px 20px",
                    borderBottom: "0.5px solid var(--bd)",
                    cursor: "pointer", transition: "background 0.15s, border-color 0.4s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sf)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {/* 색상 점 */}
                  <div style={{
                    width: 4, borderRadius: 2, flexShrink: 0, marginTop: 3,
                    background: "var(--ac)", height: 52,
                    transition: "background 0.4s",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "var(--ac)", letterSpacing: "0.8px", marginBottom: 5, transition: "color 0.4s" }}>
                      {scrapBook?.title || "책"} · {scrapBook?.author || ""}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--tp)", lineHeight: 1.7, fontStyle: "italic", transition: "color 0.4s" }}>
                      &ldquo;{s.text}&rdquo;
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                      <span style={{ fontSize: 10, color: "var(--tm)", fontWeight: 600, transition: "color 0.4s" }}>
                        {s.page_number ? `p.${s.page_number}` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
