"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { createBook, getBooks, updateBook } from "@/lib/supabase/queries";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, BookOpen, X } from "lucide-react";
import { toast } from "sonner";
import { track, EVENTS } from "@/lib/analytics";

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
  const [readingStatus, setReadingStatus] = useState<string>("reading");
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "true";
  const submittingRef = useRef(false);
  const autoSearchedRef = useRef(false);

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

      const book = await createBook(supabase, {
        user_id: user.id,
        title: selected.title,
        author: selected.author || null,
        genre: selected.category || null,
        reading_status: isOnboarding ? (readingStatus as "want_to_read" | "reading" | "finished") : "reading",
        ...(selected.cover ? { cover_url: selected.cover } : {}),
        ...(selected.pageCount ? { total_pages: selected.pageCount } : {}),
      });
      track(EVENTS.BOOK_ADDED, {
        title: selected.title,
        author: selected.author,
        genre: selected.category,
        is_onboarding: isOnboarding,
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

      toast.success("서재에 추가했어요!");
      if (isOnboarding) {
        router.push(`/discuss/${book.id}?welcome=true&readingStatus=${readingStatus}`);
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

  return (
    <div className="px-5 pt-8 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-ink hover:text-ink/70 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-serif text-xl font-black text-ink tracking-tighter">새 책 등록</h1>
      </div>

      {/* Onboarding Banner */}
      {isOnboarding && (
        <div style={{
          background: "color-mix(in srgb, var(--ac) 8%, transparent)",
          borderRadius: 12, padding: "12px 14px", marginBottom: 16,
          borderLeft: "3px solid var(--ac)", transition: "all 0.4s",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)", marginBottom: 4 }}>
            지금 읽고 있는 책을 알려주세요
          </div>
          <div style={{ fontSize: 11, color: "var(--ts)" }}>
            추가하면 바로 AI와 이 책에 대해 이야기할 수 있어요
          </div>
        </div>
      )}

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
        <div className="text-center text-warmgray text-sm py-12">검색 중</div>
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
          {isOnboarding && selected && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--tp)", marginBottom: 8 }}>
                이 책, 어디까지 읽으셨어요?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { id: "want_to_read", label: "아직 안 읽었어요" },
                  { id: "reading", label: "읽고 있는 중" },
                  { id: "finished", label: "다 읽었어요" },
                ].map((opt) => (
                  <button key={opt.id} onClick={() => setReadingStatus(opt.id)} style={{
                    flex: 1, padding: "8px 4px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                    border: `1.5px solid ${readingStatus === opt.id ? "var(--ac)" : "var(--bd2)"}`,
                    background: readingStatus === opt.id ? "color-mix(in srgb, var(--ac) 10%, var(--sf))" : "var(--sf)",
                    color: readingStatus === opt.id ? "var(--ac)" : "var(--tm)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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

      {/* Add to Library Button — 에디토리얼 */}
      {selected && (
        <Button
          onClick={handleAddToLibrary}
          disabled={adding}
          className="w-full bg-ink text-paper hover:bg-ink/90 rounded-btn h-12 text-sm font-semibold tracking-wide"
        >
          {adding ? "추가하는 중..." : "서재에 추가"}
        </Button>
      )}
    </div>
  );
}
