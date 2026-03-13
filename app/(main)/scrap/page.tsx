"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useScrapStore } from "@/stores/useScrapStore";
import { getScraps, getBooks, createScrap, deleteScrap, updateScrap } from "@/lib/supabase/queries";
import type { Book, Scrap } from "@/lib/types";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Button } from "@/components/ui/button";
import { Camera, Plus, Trash2, X, Search, Check, ChevronDown, RotateCcw, Pencil } from "lucide-react";
import { toast } from "sonner";

// ─── 전자책 스타일 하이라이트 컴포넌트 ───
type HighlightLine = { x1: number; y1: number; x2: number; y2: number };

function ImageHighlighter({
  imageUrl,
  onCrop,
  onCancel,
}: {
  imageUrl: string;
  onCrop: (croppedBase64: string) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0, natW: 0, natH: 0 });
  const [highlights, setHighlights] = useState<HighlightLine[]>([]);
  const [currentLine, setCurrentLine] = useState<HighlightLine | null>(null);
  const drawingRef = useRef(false);

  // 이미지 크기 계산
  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setImgSize({
      w: img.clientWidth,
      h: img.clientHeight,
      natW: img.naturalWidth,
      natH: img.naturalHeight,
    });
  };

  // 리사이즈 대응
  useEffect(() => {
    const handle = () => {
      const img = imgRef.current;
      if (!img) return;
      setImgSize({
        w: img.clientWidth,
        h: img.clientHeight,
        natW: img.naturalWidth,
        natH: img.naturalHeight,
      });
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return { x: 0, y: 0 };
    const rect = wrap.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return {
      x: Math.max(0, Math.min(clientX - rect.left, imgSize.w)),
      y: Math.max(0, Math.min(clientY - rect.top, imgSize.h)),
    };
  };

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    drawingRef.current = true;
    setCurrentLine({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    setCurrentLine((prev) => prev ? { ...prev, x2: pos.x, y2: pos.y } : null);
  };

  const handleEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!drawingRef.current || !currentLine) return;
    drawingRef.current = false;
    const dx = Math.abs(currentLine.x2 - currentLine.x1);
    if (dx > 20) {
      setHighlights((prev) => [...prev, currentLine]);
    }
    setCurrentLine(null);
  };

  const handleUndo = () => setHighlights((prev) => prev.slice(0, -1));

  const handleConfirm = () => {
    if (highlights.length === 0) {
      toast.error("형광펜으로 문장을 칠해주세요");
      return;
    }
    if (!imgRef.current || imgSize.natW === 0) return;

    const scaleY = imgSize.natH / imgSize.h;

    // 하이라이트 영역 (Y 기준)의 바운딩 박스
    const MARKER_HALF = 14; // 마커 두께의 절반 (display px)
    const PAD = 30; // 추가 여백

    const allYs = highlights.flatMap((h) => [h.y1, h.y2]);
    const minYd = Math.min(...allYs) - MARKER_HALF - PAD;
    const maxYd = Math.max(...allYs) + MARKER_HALF + PAD;

    const minY = Math.max(0, minYd * scaleY);
    const maxY = Math.min(imgSize.natH, maxYd * scaleY);

    // 좌우는 이미지 전체
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = imgSize.natW;
    cropCanvas.height = maxY - minY;
    const ctx = cropCanvas.getContext("2d")!;
    ctx.drawImage(
      imgRef.current,
      0, minY, imgSize.natW, maxY - minY,
      0, 0, imgSize.natW, maxY - minY,
    );

    const base64 = cropCanvas.toDataURL("image/jpeg", 0.92).split(",")[1];
    onCrop(base64);
  };

  // body 스크롤 차단
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const renderHighlight = (line: HighlightLine, key: string, opacity: number) => {
    // 형광펜 마커: 두꺼운 반투명 선
    return (
      <line
        key={key}
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke="rgba(196, 163, 90, 0.4)"
        strokeWidth={28}
        strokeLinecap="round"
        style={{ opacity }}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: "none" }}>
      {/* 상단 */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/90 shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <button onClick={onCancel} className="text-white p-2">
          <X className="w-6 h-6" />
        </button>
        <div className="text-center">
          <p className="text-white text-sm font-medium">형광펜으로 칠하세요</p>
          <p className="text-white/50 text-[11px]">문장 위를 쭉 그으면 돼요</p>
        </div>
        <button
          onClick={handleUndo}
          disabled={highlights.length === 0}
          className="text-white p-2 disabled:opacity-20"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* 이미지 + 하이라이트 오버레이 */}
      <div className="flex-1 overflow-auto bg-neutral-900">
        <div ref={wrapRef} className="relative inline-block w-full">
          <img
            ref={imgRef}
            src={imageUrl}
            onLoad={onImgLoad}
            alt="촬영한 페이지"
            className="w-full block select-none"
            draggable={false}
          />
          {/* SVG 오버레이 */}
          {imgSize.w > 0 && (
            <svg
              className="absolute top-0 left-0 w-full h-full"
              viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
              style={{ touchAction: "none" }}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
            >
              {highlights.map((h, i) => renderHighlight(h, `h-${i}`, 1))}
              {currentLine && renderHighlight(currentLine, "current", 0.7)}
            </svg>
          )}
        </div>
      </div>

      {/* 하단 */}
      <div
        className="p-4 bg-black/90 shrink-0"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        {highlights.length > 0 && (
          <p className="text-white/50 text-xs text-center mb-2">
            {highlights.length}줄 선택됨
          </p>
        )}
        <Button
          onClick={handleConfirm}
          disabled={highlights.length === 0}
          className="w-full bg-[#C4A35A] text-[#2C2C2C] hover:bg-[#C4A35A]/90 disabled:opacity-30 rounded-[8px] h-12 text-base font-semibold flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" /> 텍스트로 변환하기
        </Button>
      </div>
    </div>
  );
}

// ─── 읽기 상태 한글 라벨 ───
const STATUS_LABELS: Record<string, string> = {
  reading: "읽는 중",
  finished: "읽은 책",
  to_read: "읽을 책",
  dropped: "그만 읽은 책",
};

// ─── 메인 스크랩 페이지 ───
export default function ScrapPage() {
  const user = useAuthStore((s) => s.user);
  const { scraps, setScraps, addScrap, removeScrap, updateScrap: updateScrapInStore } = useScrapStore();

  // Books
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null); // null = 전체
  const [filterMode, setFilterMode] = useState<"chips" | "dropdown">("chips");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [memo, setMemo] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [formBookId, setFormBookId] = useState<string | null>(null);

  // Bottom sheet (9+ books dropdown)
  const [showBookSheet, setShowBookSheet] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState("");

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editPage, setEditPage] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Loading / UI
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // ─── Touch swipe ───
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent, id: string) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -80) setSwipedId(id);
    else if (dx > 40) setSwipedId(null);
  }, []);

  // ─── Data fetch ───
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      getScraps(supabase, user.id),
      getBooks(supabase, user.id),
    ])
      .then(([scrapData, bookData]) => {
        setScraps(scrapData);
        setBooks(bookData);
        setFilterMode(bookData.length >= 9 ? "dropdown" : "chips");
      })
      .catch(() => toast.error("데이터를 불러오지 못했어요"))
      .finally(() => setInitialLoading(false));
  }, [user, setScraps]);

  // ─── Scrap counts per book ───
  const scrapCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let unfiledCount = 0;
    for (const s of scraps) {
      if (s.book_id) {
        counts[s.book_id] = (counts[s.book_id] || 0) + 1;
      } else {
        unfiledCount++;
      }
    }
    return { counts, unfiledCount };
  }, [scraps]);

  // ─── Filtered scraps ───
  const filteredScraps = useMemo(() => {
    if (selectedBookId === null) return scraps;
    if (selectedBookId === "__unfiled__") return scraps.filter((s) => !s.book_id);
    return scraps.filter((s) => s.book_id === selectedBookId);
  }, [scraps, selectedBookId]);

  // ─── Recently active books (by most recent scrap) ───
  const recentBooks = useMemo(() => {
    const bookLastScrap: Record<string, string> = {};
    for (const s of scraps) {
      if (s.book_id && (!bookLastScrap[s.book_id] || s.created_at > bookLastScrap[s.book_id])) {
        bookLastScrap[s.book_id] = s.created_at;
      }
    }
    const sorted = Object.entries(bookLastScrap)
      .sort(([, a], [, b]) => b.localeCompare(a))
      .slice(0, 3)
      .map(([id]) => books.find((b) => b.id === id))
      .filter(Boolean) as Book[];
    return sorted;
  }, [scraps, books]);

  // ─── Book lookup ───
  const bookMap = useMemo(() => {
    const map: Record<string, Book> = {};
    for (const b of books) map[b.id] = b;
    return map;
  }, [books]);

  // ─── Bottom sheet filtered books ───
  const sheetBooks = useMemo(() => {
    if (!bookSearchQuery.trim()) return books;
    const q = bookSearchQuery.trim().toLowerCase();
    return books.filter(
      (b) => b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q))
    );
  }, [books, bookSearchQuery]);

  const sheetGrouped = useMemo(() => {
    const groups: Record<string, Book[]> = {};
    for (const b of sheetBooks) {
      const key = b.reading_status || "to_read";
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    }
    return groups;
  }, [sheetBooks]);

  // ─── Handlers ───
  const handleSave = async () => {
    if (!text.trim() || !user) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const selectedBook = formBookId ? bookMap[formBookId] : null;
      const scrap = await createScrap(supabase, {
        user_id: user.id,
        book_id: formBookId,
        text: text.trim(),
        memo: memo.trim() || null,
        book_title: selectedBook?.title || null,
        book_author: selectedBook?.author || null,
        page_number: pageNumber ? parseInt(pageNumber, 10) : null,
        source: "manual",
      });
      addScrap(scrap);
      setText("");
      setMemo("");
      setPageNumber("");
      setFormBookId(null);
      setShowForm(false);
      toast.success("밑줄이 저장되었어요");
    } catch {
      toast.error("저장에 실패했어요");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const supabase = createClient();
      await deleteScrap(supabase, id);
      removeScrap(id);
      toast.success("삭제되었어요");
    } catch {
      toast.error("삭제에 실패했어요");
    }
    setDeleteTarget(null);
  };

  const startEdit = (scrap: Scrap) => {
    setEditingId(scrap.id);
    setEditText(scrap.text);
    setEditMemo(scrap.memo || "");
    setEditPage(scrap.page_number?.toString() || "");
    setSwipedId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setEditMemo("");
    setEditPage("");
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    setEditSaving(true);
    try {
      const supabase = createClient();
      const updates: { text: string; memo: string | null; page_number: number | null } = {
        text: editText.trim(),
        memo: editMemo.trim() || null,
        page_number: editPage ? parseInt(editPage, 10) : null,
      };
      const updated = await updateScrap(supabase, editingId, updates);
      updateScrapInStore(editingId, updated);
      cancelEdit();
      toast.success("수정했어요");
    } catch {
      toast.error("수정에 실패했어요");
    }
    setEditSaving(false);
  };

  const handleCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setCapturedImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCrop = async (croppedBase64: string) => {
    setCapturedImage(null);
    setOcrLoading(true);
    try {
      const res = await fetchWithAuth("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: croppedBase64 }),
      });
      if (res.status === 401) {
        toast.error("로그인이 필요해요");
        setOcrLoading(false);
        return;
      }
      const data = await res.json();
      if (data.text) {
        setText(data.text);
        setShowForm(true);
        toast.success("텍스트를 추출했어요! 확인 후 저장하세요");
      } else {
        toast.error("텍스트를 인식하지 못했어요. 직접 입력해주세요.");
        setShowForm(true);
      }
    } catch {
      toast.error("OCR 처리에 실패했어요. 직접 입력해주세요.");
      setShowForm(true);
    }
    setOcrLoading(false);
  };

  const getBookDisplayName = (scrap: Scrap) => {
    if (scrap.book_id && bookMap[scrap.book_id]) return bookMap[scrap.book_id].title;
    if (scrap.book_title) return scrap.book_title;
    return "미분류";
  };

  const selectedFilterLabel = useMemo(() => {
    if (selectedBookId === null) return "전체";
    if (selectedBookId === "__unfiled__") return "미분류";
    return bookMap[selectedBookId]?.title || "전체";
  }, [selectedBookId, bookMap]);

  return (
    <>
      {/* ImageHighlighter modal */}
      {capturedImage && (
        <ImageHighlighter
          imageUrl={capturedImage}
          onCrop={handleCrop}
          onCancel={() => setCapturedImage(null)}
        />
      )}

      <div className="px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-28">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-black text-ink-green">
            ✏️ 내 밑줄 <span className="text-warmgray font-medium text-base">({scraps.length})</span>
          </h1>
        </div>

        {/* ─── Book Filter ─── */}
        {!initialLoading && books.length > 0 && (
          <div className="mb-4">
            {filterMode === "chips" ? (
              /* ── Chip row (1-8 books) ── */
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedBookId(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedBookId === null
                      ? "bg-ink-green text-paper"
                      : "bg-warm border border-[rgba(43,76,63,0.08)] text-warmgray"
                  }`}
                >
                  전체 ({scraps.length})
                </button>
                {books.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => setSelectedBookId(book.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors truncate max-w-[140px] ${
                      selectedBookId === book.id
                        ? "bg-ink-green text-paper"
                        : "bg-warm border border-[rgba(43,76,63,0.08)] text-warmgray"
                    }`}
                  >
                    {book.title} ({scrapCounts.counts[book.id] || 0})
                  </button>
                ))}
                {scrapCounts.unfiledCount > 0 && (
                  <button
                    onClick={() => setSelectedBookId("__unfiled__")}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedBookId === "__unfiled__"
                        ? "bg-ink-green text-paper"
                        : "bg-warm border border-[rgba(43,76,63,0.08)] text-warmgray"
                    }`}
                  >
                    미분류 ({scrapCounts.unfiledCount})
                  </button>
                )}
              </div>
            ) : (
              /* ── Dropdown mode (9+ books) ── */
              <div className="space-y-2">
                <button
                  onClick={() => setShowBookSheet(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-btn bg-warm border border-[rgba(43,76,63,0.08)] text-sm text-ink-green font-medium"
                >
                  <span>📖 {selectedFilterLabel}</span>
                  <ChevronDown className="w-4 h-4 text-warmgray" />
                </button>
                {recentBooks.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-warmgray">
                    <span className="shrink-0">최근:</span>
                    {recentBooks.map((book, i) => (
                      <span key={book.id}>
                        <button
                          onClick={() => setSelectedBookId(book.id)}
                          className="text-ink-green hover:underline"
                        >
                          {book.title}
                        </button>
                        {i < recentBooks.length - 1 && <span className="mx-0.5">·</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── OCR Loading ─── */}
        {ocrLoading && (
          <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4 mb-4 text-center text-sm text-warmgray">
            📸 형광펜 친 부분을 텍스트로 변환 중...
          </div>
        )}

        {/* ─── Scrap List ─── */}
        {initialLoading ? (
          <div className="text-center text-warmgray text-sm py-12">불러오는 중...</div>
        ) : filteredScraps.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">✏️</div>
            <p className="text-warmgray text-sm mb-1">
              {selectedBookId ? "이 책에 수집한 밑줄이 없어요" : "아직 수집한 밑줄이 없어요"}
            </p>
            <p className="text-warmgray/60 text-xs">마음에 드는 문장을 기록해보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredScraps.map((scrap) => (
              <div key={scrap.id} className="relative overflow-hidden rounded-card">
                {editingId === scrap.id ? (
                  /* ── Edit mode ── */
                  <div className="bg-warm border-2 border-ink-green/30 shadow-card p-4 rounded-card space-y-3">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      className="w-full bg-paper border border-[rgba(43,76,63,0.15)] rounded-btn px-3 py-2.5 text-sm text-ink resize-none leading-relaxed focus:outline-none focus:ring-1 focus:ring-ink-green/30"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editPage}
                        onChange={(e) => setEditPage(e.target.value)}
                        placeholder="페이지"
                        className="w-20 bg-paper border border-[rgba(43,76,63,0.15)] rounded-btn px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink-green/30"
                      />
                      <input
                        value={editMemo}
                        onChange={(e) => setEditMemo(e.target.value)}
                        placeholder="메모 (선택)"
                        maxLength={200}
                        className="flex-1 bg-paper border border-[rgba(43,76,63,0.15)] rounded-btn px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink-green/30"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={cancelEdit}
                        disabled={editSaving}
                        className="flex-1 rounded-btn border border-warmgray/30 text-warmgray text-sm font-semibold py-2 hover:bg-warmgray/5"
                      >
                        취소
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={editSaving || !editText.trim()}
                        className="flex-1 rounded-btn bg-ink-green text-paper text-sm font-semibold py-2 hover:bg-ink-green/90 disabled:opacity-50"
                      >
                        {editSaving ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Swipe action bg */}
                    <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4 gap-2 rounded-card">
                      <button
                        onClick={() => startEdit(scrap)}
                        className="text-paper text-xs font-semibold flex items-center gap-1 bg-ink-green/80 rounded-btn px-3 py-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" /> 수정
                      </button>
                      <button
                        onClick={() => setDeleteTarget(scrap.id)}
                        className="text-paper text-xs font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> 삭제
                      </button>
                    </div>
                    {/* Card */}
                    <div
                      className="bg-warm border border-[rgba(43,76,63,0.08)] shadow-card p-4 relative rounded-card transition-transform duration-200"
                      style={{ transform: swipedId === scrap.id ? "translateX(-110px)" : "translateX(0)" }}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={(e) => handleTouchEnd(e, scrap.id)}
                      onClick={() => swipedId === scrap.id && setSwipedId(null)}
                    >
                      {/* 문장 */}
                      <p className="text-sm leading-relaxed text-ink mb-2 line-clamp-6" style={{ fontFamily: "serif" }}>
                        &ldquo;{scrap.text}&rdquo;
                      </p>
                      {/* 책 + 페이지 */}
                      <p className="text-[11px] text-warmgray mb-1">
                        📖 {getBookDisplayName(scrap)}
                        {scrap.page_number && <span className="ml-1.5">p.{scrap.page_number}</span>}
                      </p>
                      {/* 메모 */}
                      {scrap.memo && (
                        <p className="text-xs text-warmgray italic mb-1 line-clamp-2">💭 {scrap.memo}</p>
                      )}
                      {/* 날짜 */}
                      <p className="text-[10px] text-warmgray/60 mt-2">
                        {new Date(scrap.created_at).toLocaleDateString("ko")}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── FAB Button ─── */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed right-4 bottom-20 z-30 w-14 h-14 rounded-full bg-ink-green text-paper shadow-lg flex items-center justify-center hover:bg-ink-green/90 active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* ─── Add Form (slide-up panel) ─── */}
      {showForm && (
        <div className="fixed inset-0 z-40" onClick={() => setShowForm(false)}>
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/40" />
          {/* panel */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-paper rounded-t-2xl shadow-lg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-ink-green">밑줄 추가</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-warmgray">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Book selector */}
              <select
                value={formBookId || ""}
                onChange={(e) => setFormBookId(e.target.value || null)}
                className="w-full bg-paper border border-[rgba(43,76,63,0.15)] rounded-btn px-3 py-2.5 text-sm text-ink appearance-none"
              >
                <option value="">미분류</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>

              {/* 문장 입력 */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="마음에 드는 문장을 적어주세요"
                rows={3}
                maxLength={1000}
                className="w-full bg-paper border border-[rgba(43,76,63,0.15)] rounded-btn px-3 py-2.5 text-sm text-ink resize-none leading-relaxed focus:outline-none focus:ring-1 focus:ring-ink-green/30"
              />

              {/* 페이지 + 메모 row */}
              <div className="flex gap-2">
                <input
                  type="number"
                  value={pageNumber}
                  onChange={(e) => setPageNumber(e.target.value)}
                  placeholder="페이지"
                  className="w-20 bg-paper border border-[rgba(43,76,63,0.15)] rounded-btn px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink-green/30"
                />
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="한마디 메모 (선택)"
                  maxLength={200}
                  className="flex-1 bg-paper border border-[rgba(43,76,63,0.15)] rounded-btn px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink-green/30"
                />
              </div>

              {/* Actions row */}
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={ocrLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-btn bg-warm border border-[rgba(43,76,63,0.15)] text-sm text-ink-green font-medium hover:bg-ink-green/5 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  📸 카메라
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCamera}
                  className="hidden"
                />
                <Button
                  onClick={handleSave}
                  disabled={loading || !text.trim()}
                  className="flex-1 bg-ink-green text-paper hover:bg-ink-green/90 rounded-btn h-10 font-semibold"
                >
                  {loading ? "저장 중..." : "저장하기"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Dialog ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-paper rounded-card shadow-lg p-6 w-full max-w-xs text-center">
            <p className="text-sm text-ink mb-4">이 밑줄을 삭제할까요?</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-btn border-warmgray/30 text-warmgray"
              >
                취소
              </Button>
              <Button
                onClick={() => handleDelete(deleteTarget)}
                className="flex-1 rounded-btn bg-red-500 text-paper hover:bg-red-500/90"
              >
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Book Selection Bottom Sheet (9+ books) ─── */}
      {showBookSheet && (
        <div className="fixed inset-0 z-50" onClick={() => { setShowBookSheet(false); setBookSearchQuery(""); }}>
          {/* dark overlay */}
          <div className="absolute inset-0 bg-black/50" />
          {/* sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-paper rounded-t-2xl shadow-lg max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[rgba(43,76,63,0.08)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-ink-green">책 선택</h3>
                <button onClick={() => { setShowBookSheet(false); setBookSearchQuery(""); }} className="p-1 text-warmgray">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmgray" />
                <input
                  value={bookSearchQuery}
                  onChange={(e) => setBookSearchQuery(e.target.value)}
                  placeholder="책 검색..."
                  className="w-full bg-warm border border-[rgba(43,76,63,0.08)] rounded-btn pl-9 pr-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink-green/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 전체 */}
              <button
                onClick={() => { setSelectedBookId(null); setShowBookSheet(false); setBookSearchQuery(""); }}
                className={`w-full text-left px-3 py-2 rounded-btn text-sm font-medium transition-colors ${
                  selectedBookId === null ? "bg-ink-green/10 text-ink-green" : "text-ink hover:bg-warm"
                }`}
              >
                전체 ({scraps.length})
              </button>

              {/* 미분류 */}
              {scrapCounts.unfiledCount > 0 && (
                <button
                  onClick={() => { setSelectedBookId("__unfiled__"); setShowBookSheet(false); setBookSearchQuery(""); }}
                  className={`w-full text-left px-3 py-2 rounded-btn text-sm font-medium transition-colors ${
                    selectedBookId === "__unfiled__" ? "bg-ink-green/10 text-ink-green" : "text-ink hover:bg-warm"
                  }`}
                >
                  미분류 ({scrapCounts.unfiledCount})
                </button>
              )}

              {/* Grouped by reading_status */}
              {(["reading", "finished", "to_read", "dropped"] as const).map((status) => {
                const group = sheetGrouped[status];
                if (!group || group.length === 0) return null;
                return (
                  <div key={status}>
                    <p className="text-[11px] font-semibold text-warmgray uppercase tracking-wide mb-1.5 px-1">
                      {STATUS_LABELS[status]}
                    </p>
                    <div className="space-y-0.5">
                      {group.map((book) => (
                        <button
                          key={book.id}
                          onClick={() => { setSelectedBookId(book.id); setShowBookSheet(false); setBookSearchQuery(""); }}
                          className={`w-full text-left px-3 py-2 rounded-btn text-sm transition-colors flex items-center justify-between ${
                            selectedBookId === book.id ? "bg-ink-green/10 text-ink-green font-medium" : "text-ink hover:bg-warm"
                          }`}
                        >
                          <span className="truncate">{book.title}</span>
                          <span className="text-xs text-warmgray shrink-0 ml-2">
                            {scrapCounts.counts[book.id] || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
