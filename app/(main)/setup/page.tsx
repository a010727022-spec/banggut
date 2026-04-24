"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { createBook, getBooks, updateBook, getProfile } from "@/lib/supabase/queries";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, BookOpen, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ReadingStatus } from "@/lib/types";

// 장르 id → 알라딘 검색어 매핑 (온보딩의 GENRE_OPTIONS와 동일한 ID 사용)
const GENRE_LABEL: Record<string, string> = {
  novel: "소설",
  essay: "에세이",
  humanities: "인문",
  selfhelp: "자기계발",
  science: "과학",
  history: "역사",
  webnovel: "웹소설",
  fantasy: "판타지",
  mystery: "추리",
  romance: "로맨스",
  business: "경영",
  art: "예술",
};

interface BookResult {
  title: string;
  author: string;
  publisher?: string;
  pubDate?: string;
  cover?: string;
  description?: string;
  isbn?: string;
  category?: string;
  pageCount?: number | null;
}

export default function SetupPage() {
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [selected, setSelected] = useState<BookResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showManualAuthor, setShowManualAuthor] = useState(false);
  const [manualAuthor, setManualAuthor] = useState("");
  const [bestsellers, setBestsellers] = useState<BookResult[]>([]);
  const [loadingBestsellers, setLoadingBestsellers] = useState(false);
  const [startingBlank, setStartingBlank] = useState(false);
  // 취향 기반 추천
  const [userGenres, setUserGenres] = useState<string[]>([]);
  const [recommendedBooks, setRecommendedBooks] = useState<BookResult[]>([]);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  // 상태 선택
  const [selectedStatus, setSelectedStatus] = useState<ReadingStatus>("reading");
  const [planToStartAt, setPlanToStartAt] = useState<string>("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const submittingRef = useRef(false);
  const autoSearchedRef = useRef(false);
  const bestsellersFetchedRef = useRef(false);

  // 베스트셀러 조회 (마운트 시 1회, 자동 검색 없을 때만)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) return; // 자동 검색이 있으면 베스트셀러 fetch 스킵
    if (bestsellersFetchedRef.current) return;
    bestsellersFetchedRef.current = true;
    setLoadingBestsellers(true);
    fetchWithAuth("/api/bestsellers")
      .then((res) => (res.ok ? res.json() : { books: [] }))
      .then((data) => setBestsellers((data.books || []).slice(0, 8)))
      .catch(() => {
        /* 실패해도 조용히 — 검색은 여전히 가능 */
      })
      .finally(() => setLoadingBestsellers(false));
  }, [searchParams]);

  // 유저 프로필 → 선호 장르 → 추천 책 fetch
  useEffect(() => {
    const q = searchParams.get("q");
    if (q || !user) return;
    const supabase = createClient();
    (async () => {
      try {
        const profile = await getProfile(supabase, user.id);
        const genres = profile?.preferred_genres || [];
        if (genres.length === 0) return;
        setUserGenres(genres);
        setActiveGenre(genres[0]);
      } catch {
        /* 무시 */
      }
    })();
  }, [user, searchParams]);

  // activeGenre 변경 시 추천 책 재fetch — 장르별 베스트셀러
  useEffect(() => {
    if (!activeGenre) return;
    setLoadingRecs(true);
    fetchWithAuth(`/api/bestsellers?genre=${encodeURIComponent(activeGenre)}`)
      .then((res) => (res.ok ? res.json() : { books: [] }))
      .then((data) => setRecommendedBooks((data.books || []).slice(0, 12)))
      .catch(() => setRecommendedBooks([]))
      .finally(() => setLoadingRecs(false));
  }, [activeGenre]);

  // URL에서 ?q= 파라미터로 자동 검색
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSearchedRef.current) {
      autoSearchedRef.current = true;
      setQuery(q);
      setTimeout(() => {
        const fakeSearch = async () => {
          setSearching(true);
          try {
            const res = await fetchWithAuth("/api/search-book", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: q.trim() }),
            });
            if (res.ok) {
              const data = await res.json();
              setResults(data.books || []);
              setHasSearched(true);
            }
          } catch {
            // 무시
          }
          setSearching(false);
        };
        fakeSearch();
      }, 100);
    }
  }, [searchParams]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);
    setShowManualAuthor(false);
    setManualAuthor("");
    try {
      const res = await fetchWithAuth("/api/search-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (res.status === 401) {
        toast.error("로그인이 필요해요");
        setSearching(false);
        return;
      }
      const data = await res.json();
      setResults(data.books || []);
      setHasSearched(true);
    } catch {
      toast.error("검색에 실패했어요");
    }
    setSearching(false);
  };

  const handleAddToLibrary = async () => {
    if (!selected) { toast.error("책을 선택해주세요"); return; }
    if (!user) { toast.error("로그인이 필요해요"); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setAdding(true);
    try {
      const supabase = createClient();

      // 중복 체크
      const existing = await getBooks(supabase, user.id);
      const dup = existing.find(
        (b) => b.title === selected.title && (b.author || "") === (selected.author || ""),
      );
      if (dup) {
        toast.error("이미 서재에 있는 책이에요");
        setAdding(false);
        submittingRef.current = false;
        return;
      }

      const nowIso = new Date().toISOString();
      const statusFields: Record<string, unknown> = { reading_status: selectedStatus };
      if (selectedStatus === "reading") {
        statusFields.started_at = nowIso;
      } else if (selectedStatus === "finished") {
        statusFields.started_at = nowIso;
        statusFields.finished_at = nowIso;
        if (selected.pageCount) {
          statusFields.current_page = selected.pageCount;
          statusFields.progress_percent = 100;
        } else {
          statusFields.progress_percent = 100;
        }
      } else if (selectedStatus === "want_to_read" && planToStartAt) {
        statusFields.plan_to_start_at = planToStartAt;
      }

      const book = await createBook(supabase, {
        user_id: user.id,
        title: selected.title,
        author: selected.author || null,
        genre: selected.category || null,
        ...statusFields,
        ...(selected.cover ? { cover_url: selected.cover } : {}),
        ...(selected.pageCount ? { total_pages: selected.pageCount } : {}),
      });

      // 백그라운드: 주제 지도 (실패해도 OK)
      fetchWithAuth("/api/topic-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: selected.title, author: selected.author }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.topics?.length > 0) {
            updateBook(supabase, book.id, { topic_map: data });
          }
        })
        .catch(() => {});

      // 알라딘 커버가 없을 때만 book-cover API로 폴백
      if (!selected.cover) {
        fetch(`/api/book-cover?title=${encodeURIComponent(selected.title)}&author=${encodeURIComponent(selected.author || "")}`)
          .then((res) => res.json())
          .then((data) => {
            const updates: Record<string, unknown> = {};
            if (data.cover_url) updates.cover_url = data.cover_url;
            if (data.page_count) updates.total_pages = data.page_count;
            if (Object.keys(updates).length > 0) {
              updateBook(supabase, book.id, updates);
            }
          })
          .catch(() => {});
      }

      // 책 등록 즉시 book-context fetch 시작 (fire-and-forget)
      fetchWithAuth("/api/book-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selected.title,
          author: selected.author,
          bookId: book.id,
          description: selected.description || null,
        }),
      }).catch(() => {});

      const toastMsg =
        selectedStatus === "want_to_read"
          ? "위시리스트에 담았어요"
          : selectedStatus === "finished"
          ? "완독 기록을 남겨볼까요?"
          : "첫 페이지를 펼쳐봐요";
      toast.success(toastMsg);

      // 상태별 이동 경로 분기
      if (selectedStatus === "want_to_read") {
        router.push("/?tab=wish");
      } else if (selectedStatus === "finished") {
        router.push(`/book/${book.id}?review=new`);
      } else {
        router.push(`/book/${book.id}`);
      }
    } catch (err) {
      console.error("Book creation failed:", err);
      const e = err as Record<string, string> | null;
      const msg = e?.message || e?.error_description || "알 수 없는 오류";
      toast.error(`책 등록 실패: ${msg}`);
    }
    setAdding(false);
    submittingRef.current = false;
  };

  /**
   * "책 없이 시작하기" 흐름.
   * 가상의 빈 책 레코드를 생성하고 홈으로 돌려보냄. 같은 유저에게 이미 빈 책이 있으면 재활용.
   */
  const handleStartBlank = async () => {
    if (!user) { toast.error("로그인이 필요해요"); return; }
    if (startingBlank) return;
    setStartingBlank(true);
    try {
      const supabase = createClient();
      const existing = await getBooks(supabase, user.id);
      const virtual = existing.find((b) => b.title === "아직 정하지 않음");

      if (virtual) {
        toast.success("이어서 시작해요");
        router.push("/");
        return;
      }

      await createBook(supabase, {
        user_id: user.id,
        title: "아직 정하지 않음",
        author: null,
        reading_status: "reading",
        started_at: new Date().toISOString(),
      });
      toast.success("책은 나중에 정해도 돼요");
      router.push("/");
    } catch (err) {
      console.error("Blank-start failed:", err);
      const e = err as Record<string, string> | null;
      const msg = e?.message || "알 수 없는 오류";
      toast.error(`시작 실패: ${msg}`);
      setStartingBlank(false);
    }
  };

  return (
    <div className="px-5 pt-8 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-ink hover:text-ink/70 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-serif text-xl font-black text-ink tracking-tighter">새 책 등록</h1>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="제목 + 저자 검색"
          maxLength={200}
          className="bg-warm border-ink/[0.08] rounded-btn flex-1 text-sm placeholder:text-warmgray-light"
        />
        <Button
          onClick={handleSearch}
          disabled={searching}
          className="bg-ink text-paper hover:bg-ink/90 rounded-btn px-3"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {searching && (
        <div className="text-center text-warmgray text-sm py-12">검색 중...</div>
      )}

      {/* 취향 기반 추천 — 검색 전 · 미선택 · 장르 있을 때만 */}
      {!hasSearched && !selected && !searching && userGenres.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <img src="/logo-banggut.svg" alt="" className="w-8 h-8" />
            <p
              className="text-[15px] text-ink-green flex-1"
              style={{ fontFamily: "'Gaegu', cursive", fontWeight: 700, letterSpacing: "0.02em" }}
            >
              취향 추천
            </p>
          </div>

          {/* 북마크 태그 스타일 장르 칩 (Gail's pick: E) */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-5 px-5 pb-3 mb-1">
            {userGenres.map((gId) => {
              const active = activeGenre === gId;
              const label = GENRE_LABEL[gId] || gId;
              return (
                <button
                  key={gId}
                  onClick={() => setActiveGenre(gId)}
                  className="relative flex-shrink-0 py-1.5 pl-5 pr-3.5 text-xs font-bold transition-all"
                  style={{
                    borderRadius: "4px 16px 16px 4px",
                    border: `1px solid ${active ? "var(--ac)" : "rgba(90,110,95,0.18)"}`,
                    background: active ? "color-mix(in srgb, var(--ac) 10%, var(--bg))" : "var(--sf)",
                    color: active ? "var(--ac)" : "var(--ts)",
                  }}
                >
                  <span
                    className="absolute top-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: "6px",
                      width: "6px",
                      height: "6px",
                      background: active ? "var(--ac)" : "rgba(90,110,95,0.3)",
                    }}
                  />
                  {label}
                </button>
              );
            })}
          </div>

          {/* 추천 책 가로 스크롤 */}
          {loadingRecs ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[88px]">
                  <div className="w-[88px] h-[128px] bg-ink/[0.04] rounded-[1px]" />
                </div>
              ))}
            </div>
          ) : recommendedBooks.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2 scrollbar-none">
              {recommendedBooks.map((book, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(book)}
                  className="flex-shrink-0 w-[88px] text-left group"
                  aria-label={`${book.title} 선택`}
                >
                  {book.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="w-[88px] h-[128px] rounded-[2px] object-cover group-hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-[88px] h-[128px] bg-ink/[0.04] rounded-[2px] flex items-center justify-center border border-ink/[0.06]">
                      <BookOpen className="w-5 h-5 text-ink/20" />
                    </div>
                  )}
                  <p className="text-xs font-semibold text-ink mt-2 line-clamp-2 leading-snug">
                    {book.title}
                  </p>
                  <p className="text-[11px] text-warmgray mt-0.5 truncate">{book.author}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-warmgray-light py-4 text-center">아직 추천할 책이 없어요</p>
          )}
        </div>
      )}

      {/* Bestsellers — 검색 전 · 미선택 상태에서만 노출 */}
      {!hasSearched && !selected && !searching && (
        <div className="mb-8">
          <p className="editorial-caption mb-3">이번 주 인기</p>
          {loadingBestsellers ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[88px]">
                  <div className="w-[88px] h-[128px] bg-ink/[0.04] rounded-[1px]" />
                  <div className="h-3 bg-ink/[0.04] rounded mt-2 w-full" />
                  <div className="h-3 bg-ink/[0.04] rounded mt-1 w-3/4" />
                </div>
              ))}
            </div>
          ) : bestsellers.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2 scrollbar-none">
              {bestsellers.map((book, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(book)}
                  className="flex-shrink-0 w-[88px] text-left group"
                  aria-label={`${book.title} 선택`}
                >
                  {book.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="w-[88px] h-[128px] rounded-[1px] object-cover group-hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-[88px] h-[128px] bg-ink/[0.04] rounded-[1px] flex items-center justify-center border border-ink/[0.06]">
                      <BookOpen className="w-5 h-5 text-ink/20" />
                    </div>
                  )}
                  <p className="text-xs font-semibold text-ink mt-2 line-clamp-2 leading-snug">
                    {book.title}
                  </p>
                  <p className="text-[11px] text-warmgray mt-0.5 truncate">{book.author}</p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Start Blank CTA — 검색 전 · 미선택 상태에서만 노출 */}
      {!hasSearched && !selected && !searching && (
        <button
          onClick={handleStartBlank}
          disabled={startingBlank}
          className="w-full flex items-center justify-center gap-2 py-4 mb-4 border border-dashed border-ink/15 rounded-btn text-sm text-warmgray hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          <span>{startingBlank ? "준비 중..." : "책 없이 먼저 둘러볼게요"}</span>
        </button>
      )}

      {/* Search Empty State */}
      {hasSearched && results.length === 0 && !selected && !searching && (
        <div className="text-center py-12 mb-4">
          <p className="text-warmgray text-sm mb-4">검색 결과가 없어요</p>
          <button
            onClick={() => {
              setSelected({ title: query.trim(), author: "" });
              setShowManualAuthor(true);
            }}
            className="text-sm text-ink font-semibold border-b border-ink pb-0.5 hover:opacity-70 transition-opacity"
          >
            직접 등록하기
          </button>
        </div>
      )}

      {/* Search Results — 에디토리얼 리스트 */}
      {results.length > 0 && !selected && (
        <div className="mb-4">
          <p className="editorial-caption mb-3">검색 결과</p>
          <div className="divide-y divide-ink/[0.06]">
            {results.map((book, i) => (
              <button
                key={i}
                onClick={() => setSelected(book)}
                className="w-full text-left py-3.5 flex gap-3 hover:bg-ink/[0.02] transition-colors"
              >
                {book.cover && (
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="w-10 h-14 rounded-[1px] object-cover flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">{book.title}</p>
                  <p className="text-xs text-warmgray mt-0.5">
                    {book.author} {book.publisher && `· ${book.publisher}`} {book.pubDate && `· ${book.pubDate.slice(0, 4)}`}{book.pageCount ? ` · ${book.pageCount}p` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setSelected({ title: query.trim(), author: "" });
              setShowManualAuthor(true);
            }}
            className="w-full text-center text-sm text-ink font-semibold py-4 border-t border-ink/[0.06] hover:opacity-70 transition-opacity"
          >
            직접 등록하기
          </button>
        </div>
      )}

      {/* Selected Book — 미니멀 카드 */}
      {selected && (
        <div className="border-t border-b border-ink/[0.08] py-5 mb-4">
          <div className="flex items-start gap-4">
            {selected.cover ? (
              <img src={selected.cover} alt={selected.title} className="w-14 h-20 rounded-[1px] object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-20 bg-ink/[0.04] rounded-[1px] flex items-center justify-center flex-shrink-0 border border-ink/[0.06]">
                <BookOpen className="w-5 h-5 text-ink/20" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-ink font-serif">{selected.title}</p>
              <p className="text-sm text-warmgray mt-0.5">{selected.author}</p>
              {selected.publisher && (
                <p className="text-xs text-warmgray-light mt-1">{selected.publisher} {selected.pubDate && `· ${selected.pubDate.slice(0, 4)}`}</p>
              )}
            </div>
            <button
              onClick={() => {
                setSelected(null);
                setShowManualAuthor(false);
                setManualAuthor("");
              }}
              className="text-warmgray hover:text-ink p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Manual Author Input */}
      {selected && showManualAuthor && (
        <div className="mb-4">
          <Input
            value={manualAuthor}
            onChange={(e) => {
              setManualAuthor(e.target.value);
              setSelected({ ...selected, author: e.target.value });
            }}
            placeholder="저자 (선택)"
            className="bg-warm border-ink/[0.08] rounded-btn text-sm"
          />
        </div>
      )}

      {/* 상태 선택 (어떻게 등록할까요?) */}
      {selected && (
        <div className="mb-4">
          <p
            className="text-[15px] text-ink-green mb-3 text-center"
            style={{ fontFamily: "'Gaegu', cursive", fontWeight: 700, letterSpacing: "0.02em" }}
          >
            어떻게 등록할까요?
          </p>
          <div className="flex flex-col gap-2.5">
            {([
              { id: "reading", emoji: "📖", label: "읽는 중", desc: "지금부터 읽기 시작해요" },
              { id: "want_to_read", emoji: "🌙", label: "위시리스트", desc: "나중에 읽고 싶어요" },
              { id: "finished", emoji: "✓", label: "완독한 책", desc: "이미 다 읽었어요" },
            ] as const satisfies readonly { id: ReadingStatus; emoji: string; label: string; desc: string }[]).map((opt) => {
              const active = selectedStatus === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSelectedStatus(opt.id)}
                  className="flex items-center gap-3.5 py-3.5 px-4 text-left transition-all"
                  style={{
                    borderRadius: "18px",
                    border: `1.5px solid ${active ? "var(--ac)" : "rgba(90,110,95,0.15)"}`,
                    background: active ? "color-mix(in srgb, var(--ac) 9%, var(--bg))" : "var(--sf)",
                    boxShadow: active ? "0 4px 14px color-mix(in srgb, var(--ac) 18%, transparent)" : "0 2px 6px rgba(45,58,53,0.03)",
                  }}
                >
                  <div
                    className="flex items-center justify-center flex-shrink-0 text-[20px]"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 16,
                      background: active ? "color-mix(in srgb, var(--ac) 18%, var(--sf2))" : "var(--sf2)",
                      transform: active ? "rotate(-5deg) scale(1.05)" : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    {opt.emoji}
                  </div>
                  <div className="flex-1">
                    <div
                      className="text-[14px] leading-tight"
                      style={{
                        fontWeight: 700,
                        color: active ? "var(--ac)" : "var(--tp)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {opt.label}
                    </div>
                    <div className="text-[11.5px] text-warmgray mt-0.5 leading-tight">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 위시 선택 시: 언제부터 읽을 거예요? 계획일 입력 */}
          {selectedStatus === "want_to_read" && (
            <div
              className="mt-3 p-4"
              style={{
                borderRadius: 18,
                border: "1.5px dashed color-mix(in srgb, var(--ac) 35%, transparent)",
                background: "color-mix(in srgb, var(--ac) 5%, var(--bg))",
              }}
            >
              <label
                className="block text-[13px] mb-2"
                style={{
                  fontFamily: "'Gaegu', cursive",
                  fontWeight: 700,
                  color: "var(--tp)",
                  letterSpacing: "0.02em",
                }}
              >
                📅 언제부터 읽을까요? <span className="text-warmgray-light font-normal text-[11px]" style={{ fontFamily: "'Pretendard', sans-serif" }}>(선택)</span>
              </label>
              <input
                type="date"
                value={planToStartAt}
                onChange={(e) => setPlanToStartAt(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full h-11 px-4 rounded-2xl text-[14px] outline-none"
                style={{
                  border: "1px solid rgba(90,110,95,0.2)",
                  background: "var(--sf)",
                  color: "var(--tp)",
                  fontFamily: "'Pretendard', sans-serif",
                  fontWeight: 500,
                }}
              />
              <p className="text-[11px] text-warmgray-light mt-2 leading-relaxed">
                그날이 오면 방긋이가 살짝 알려드릴게요
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add to Library Button — 상태별 카피 + 힌트 */}
      {selected && (() => {
        const ctaByStatus = {
          reading: { cta: "지금 읽으러 가기 →", hint: "책 상세 페이지로 이동해요" },
          want_to_read: { cta: "위시에 담기", hint: "위시리스트로 담겨요" },
          finished: { cta: "완독 기록 남기기 →", hint: "서평을 바로 작성할 수 있어요" },
        } as const;
        const { cta, hint } = ctaByStatus[selectedStatus as keyof typeof ctaByStatus] ?? ctaByStatus.reading;
        return (
          <>
            <Button
              onClick={handleAddToLibrary}
              disabled={adding}
              className="w-full text-paper rounded-full h-[52px] font-bold tracking-wide"
              style={{
                fontFamily: "'Gaegu', cursive",
                fontSize: 18,
                letterSpacing: "0.04em",
                background: "linear-gradient(135deg, var(--ac), var(--ac2))",
                boxShadow: "0 6px 18px color-mix(in srgb, var(--ac) 30%, transparent)",
              }}
            >
              {adding ? "준비 중..." : cta}
            </Button>
            <p className="text-center text-[11px] text-warmgray-light mt-3 font-medium">
              {hint}
            </p>
          </>
        );
      })()}
    </div>
  );
}
