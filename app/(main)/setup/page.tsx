"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useScrapStore } from "@/stores/useScrapStore";
import { createBook, getScraps, createUnderline, updateBook } from "@/lib/supabase/queries";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, Check, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface BookResult {
  title: string;
  author: string;
  publisher?: string;
  year?: number;
}

export default function SetupPage() {
  const user = useAuthStore((s) => s.user);
  const { scraps, setScraps } = useScrapStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [selected, setSelected] = useState<BookResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedScraps, setSelectedScraps] = useState<string[]>([]);
  const [showScrapSheet, setShowScrapSheet] = useState(false);
  const [creating, setCreating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showManualAuthor, setShowManualAuthor] = useState(false);
  const [manualAuthor, setManualAuthor] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    getScraps(supabase, user.id).then(setScraps);
  }, [user, setScraps]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
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

  const toggleScrap = (id: string) => {
    setSelectedScraps((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  const handleStart = async () => {
    if (!selected) { toast.error("책을 선택해주세요"); return; }
    if (!user) { toast.error("로그인이 필요해요"); return; }
    setCreating(true);
    try {
      const supabase = createClient();
      const book = await createBook(supabase, {
        user_id: user.id,
        title: selected.title,
        author: selected.author || null,
      });

      // Import selected scraps as underlines
      for (const scrapId of selectedScraps) {
        const scrap = scraps.find((s) => s.id === scrapId);
        if (scrap) {
          await createUnderline(supabase, {
            book_id: book.id,
            scrap_id: scrap.id,
            text: scrap.text,
            memo: scrap.memo,
            chapter: null,
          });
        }
      }

      // 백그라운드 병렬: 주제 지도 + 커버 이미지 + book context 파이프라인 (실패해도 OK)
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

      // 🔥 책 등록 즉시 book-context 파이프라인 시작 (SSE fire-and-forget)
      // book detail 페이지에서 context_status를 체크하여 완료될 때까지 토론 버튼 비활성화
      fetchWithAuth("/api/book-context/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selected.title,
          author: selected.author,
          bookId: book.id,
        }),
      })
        .then(async (res) => {
          // SSE 스트림을 끝까지 소비해야 서버 파이프라인이 완료됨
          const reader = res.body?.getReader();
          if (reader) {
            while (true) {
              const { done } = await reader.read();
              if (done) break;
            }
          }
        })
        .catch(() => {});

      router.push(`/book/${book.id}`);
    } catch (err) {
      console.error("Book creation failed:", err);
      const e = err as Record<string, string> | null;
      const msg = e?.message || e?.error_description || "알 수 없는 오류";
      toast.error(`책 등록 실패: ${msg}`);
    }
    setCreating(false);
  };

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-ink-green">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black text-ink-green">새 책 등록</h1>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="제목 + 저자 검색"
          maxLength={200}
          className="bg-warm border-[rgba(43,76,63,0.15)] rounded-btn flex-1"
        />
        <Button
          onClick={handleSearch}
          disabled={searching}
          className="bg-ink-green text-paper hover:bg-ink-medium rounded-btn px-3"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {searching && (
        <div className="text-center text-warmgray text-sm py-8">🔍 검색 중...</div>
      )}

      {/* Search Empty State */}
      {hasSearched && results.length === 0 && !selected && !searching && (
        <div className="text-center py-8 mb-4">
          <p className="text-warmgray text-sm mb-3">검색 결과가 없어요</p>
          <button
            onClick={() => {
              setSelected({ title: query.trim(), author: "" });
              setShowManualAuthor(true);
            }}
            className="text-sm text-ink-green font-semibold hover:underline"
          >
            직접 등록하기
          </button>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && !selected && (
        <div className="space-y-2 mb-4">
          {results.map((book, i) => (
            <button
              key={i}
              onClick={() => setSelected(book)}
              className="w-full text-left bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-3 hover:border-ink-green/30 transition-colors"
            >
              <p className="text-sm font-semibold text-ink">{book.title}</p>
              <p className="text-xs text-warmgray">
                {book.author} {book.publisher && `· ${book.publisher}`} {book.year && `· ${book.year}`}
              </p>
            </button>
          ))}
          <button
            onClick={() => {
              setSelected({ title: query.trim(), author: "" });
              setShowManualAuthor(true);
            }}
            className="w-full text-center text-sm text-ink-green font-semibold py-2 hover:underline"
          >
            직접 등록하기
          </button>
        </div>
      )}

      {/* Selected Book */}
      {selected && (
        <div className="bg-warm rounded-card border border-ink-green/20 shadow-card p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-14 h-18 bg-ink-green/10 rounded-md flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-ink-green" />
            </div>
            <div>
              <p className="text-base font-semibold text-ink">{selected.title}</p>
              <p className="text-sm text-warmgray">{selected.author}</p>
            </div>
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
            className="bg-warm border-[rgba(43,76,63,0.15)] rounded-btn"
          />
        </div>
      )}

      {/* Scrap Import */}
      {selected && scraps.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowScrapSheet(!showScrapSheet)}
            className="w-full text-left bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-3 text-sm text-ink-green font-semibold"
          >
            📥 스크랩에서 불러오기 ({selectedScraps.length}/3)
          </button>

          {showScrapSheet && (
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {scraps.map((scrap) => (
                <button
                  key={scrap.id}
                  onClick={() => toggleScrap(scrap.id)}
                  className={`w-full text-left p-3 rounded-card border transition-colors ${
                    selectedScraps.includes(scrap.id)
                      ? "border-ink-green bg-ink-green/5"
                      : "border-[rgba(43,76,63,0.08)] bg-warm"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        selectedScraps.includes(scrap.id)
                          ? "bg-ink-green text-paper"
                          : "border border-warmgray-light"
                      }`}
                    >
                      {selectedScraps.includes(scrap.id) && <Check className="w-3 h-3" />}
                    </div>
                    <p className="text-xs leading-body text-ink line-clamp-2">
                      &ldquo;{scrap.text}&rdquo;
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Start Button */}
      {selected && (
        <Button
          onClick={handleStart}
          disabled={creating}
          className="w-full bg-ink-green text-paper hover:bg-ink-medium rounded-btn h-12 text-base font-semibold"
        >
          {creating
            ? "준비 중..."
            : selectedScraps.length > 0
            ? `🎯 글귀 ${selectedScraps.length}개로 토론 시작`
            : "💬 바로 토론 시작"}
        </Button>
      )}
    </div>
  );
}
