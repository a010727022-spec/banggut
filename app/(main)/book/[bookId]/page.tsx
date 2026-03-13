"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getBook,
  getMessages,
  getScrapsByBook,
  createScrap,
  getReview,
  updateBook,
  deleteBook,
} from "@/lib/supabase/queries";
import { PHASES, getPhaseIndex } from "@/lib/types";
import type { Book, Message, Scrap, Review, ReadingStatus, Diagnosis } from "@/lib/types";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useAuthStore } from "@/stores/useAuthStore";
import Link from "next/link";
import { ArrowLeft, Star, Camera, Eye, EyeOff, Check, RotateCcw, X, Trash2, ImagePlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type Tab = "scraps" | "discussion" | "review";

const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = [
  { value: "want_to_read", label: "읽고 싶은" },
  { value: "to_read", label: "읽을 책" },
  { value: "reading", label: "읽는 중" },
  { value: "finished", label: "읽은 책" },
  { value: "abandoned", label: "중단" },
];

/* ═══════════════════════ Star Rating ═══════════════════════ */

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  function handleClick(starIndex: number, e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeftHalf = x < rect.width / 2;
    const newValue = isLeftHalf ? starIndex + 0.5 : starIndex + 1;
    onChange(newValue);
  }

  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = value >= i + 1;
        const halfFilled = !filled && value >= i + 0.5;

        return (
          <button
            key={i}
            type="button"
            onClick={(e) => handleClick(i, e)}
            className="relative w-8 h-8 flex items-center justify-center"
          >
            {/* Empty star (background) */}
            <Star className="w-6 h-6 text-warmgray/30" />
            {/* Filled portion */}
            {(filled || halfFilled) && (
              <div
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
                style={{ width: filled ? "100%" : "50%" }}
              >
                <Star className="w-6 h-6 text-[#C4A35A] fill-[#C4A35A]" />
              </div>
            )}
          </button>
        );
      })}
      <span className="text-sm font-semibold text-[#C4A35A] ml-1">
        {value > 0 ? value.toFixed(1) : ""}
      </span>
    </div>
  );
}

/* ═══════════════════════ ImageHighlighter ═══════════════════════ */

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
    setCurrentLine((prev) => (prev ? { ...prev, x2: pos.x, y2: pos.y } : null));
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

    const MARKER_HALF = 14;
    const PAD = 30;

    const allYs = highlights.flatMap((h) => [h.y1, h.y2]);
    const minYd = Math.min(...allYs) - MARKER_HALF - PAD;
    const maxYd = Math.max(...allYs) + MARKER_HALF + PAD;

    const minY = Math.max(0, minYd * scaleY);
    const maxY = Math.min(imgSize.natH, maxYd * scaleY);

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = imgSize.natW;
    cropCanvas.height = maxY - minY;
    const ctx = cropCanvas.getContext("2d")!;
    ctx.drawImage(
      imgRef.current,
      0,
      minY,
      imgSize.natW,
      maxY - minY,
      0,
      0,
      imgSize.natW,
      maxY - minY,
    );

    const base64 = cropCanvas.toDataURL("image/jpeg", 0.92).split(",")[1];
    onCrop(base64);
  };

  // body scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const renderHighlight = (line: HighlightLine, key: string, opacity: number) => {
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
      {/* Top bar */}
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

      {/* Image + highlight overlay */}
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

      {/* Bottom bar */}
      <div
        className="p-4 bg-black/90 shrink-0"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        {highlights.length > 0 && (
          <p className="text-white/50 text-xs text-center mb-2">
            {highlights.length}줄 선택됨
          </p>
        )}
        <button
          onClick={handleConfirm}
          disabled={highlights.length === 0}
          className="w-full bg-[#C4A35A] text-[#2C2C2C] hover:bg-[#C4A35A]/90 disabled:opacity-30 rounded-btn h-12 text-base font-semibold flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" /> 텍스트로 변환하기
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════ Radar Chart ═══════════════════════ */

function RadarChart({ diagnosis }: { diagnosis: Diagnosis }) {
  const dims = diagnosis.dimensions;
  const count = dims.length;
  if (count === 0) return null;

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 100;
  const levels = 5;

  // Angle for each dimension (starting from top, going clockwise)
  const angleStep = (2 * Math.PI) / count;
  const startAngle = -Math.PI / 2;

  function polarToXY(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }

  // Grid polygons (levels 1-5)
  const gridPolygons = Array.from({ length: levels }, (_, level) => {
    const r = ((level + 1) / levels) * maxR;
    const points = Array.from({ length: count }, (_, i) => {
      const angle = startAngle + i * angleStep;
      const { x, y } = polarToXY(angle, r);
      return `${x},${y}`;
    }).join(" ");
    return points;
  });

  // Data polygon
  const dataPoints = dims.map((dim, i) => {
    const angle = startAngle + i * angleStep;
    const r = (Math.min(dim.score, 5) / 5) * maxR;
    return polarToXY(angle, r);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Label positions (pushed further out)
  const labelPositions = dims.map((dim, i) => {
    const angle = startAngle + i * angleStep;
    const { x, y } = polarToXY(angle, maxR + 32);
    return { x, y, label: dim.label, score: dim.score };
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px]">
        {/* Grid lines */}
        {gridPolygons.map((points, i) => (
          <polygon
            key={`grid-${i}`}
            points={points}
            fill="none"
            stroke="rgba(43,76,63,0.12)"
            strokeWidth={i === levels - 1 ? 1.5 : 0.8}
          />
        ))}

        {/* Axis lines */}
        {dims.map((_, i) => {
          const angle = startAngle + i * angleStep;
          const { x, y } = polarToXY(angle, maxR);
          return (
            <line
              key={`axis-${i}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(43,76,63,0.08)"
              strokeWidth={0.8}
            />
          );
        })}

        {/* Data area */}
        <polygon
          points={dataPolygon}
          fill="rgba(43,76,63,0.15)"
          stroke="rgba(43,76,63,0.7)"
          strokeWidth={2}
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle
            key={`dot-${i}`}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="#2B4C3F"
            stroke="white"
            strokeWidth={1.5}
          />
        ))}

        {/* Labels */}
        {labelPositions.map((lp, i) => (
          <g key={`label-${i}`}>
            <text
              x={lp.x}
              y={lp.y - 6}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[10px] font-medium"
              fill="#2B4C3F"
            >
              {lp.label}
            </text>
            <text
              x={lp.x}
              y={lp.y + 8}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[10px] font-bold"
              fill="#C4A35A"
            >
              {lp.score.toFixed(1)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ═══════════════════════ Main Page ═══════════════════════ */

export default function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();
  const supabaseRef = useRef(createClient());

  const user = useAuthStore((s) => s.user);

  const [book, setBook] = useState<Book | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("scraps");
  const [isLoading, setIsLoading] = useState(true);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Abandon state
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const [abandonNote, setAbandonNote] = useState("");

  // Context preparation state
  const [contextStatus, setContextStatus] = useState<"idle" | "fetching" | "done" | "failed">("idle");
  const contextStartedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Editable fields (local state for controlled inputs)
  const [currentPage, setCurrentPage] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [rating, setRating] = useState(0);
  const [oneLiner, setOneLiner] = useState("");

  useEffect(() => {
    if (!bookId) return;
    const supabase = supabaseRef.current;

    async function load() {
      const [bookData, msgs, scrapData, rev] = await Promise.all([
        getBook(supabase, bookId),
        getMessages(supabase, bookId),
        getScrapsByBook(supabase, bookId),
        getReview(supabase, bookId),
      ]);
      setBook(bookData);
      setMessages(msgs);
      setScraps(scrapData);
      setReview(rev);

      if (bookData) {
        setCurrentPage(bookData.current_page?.toString() ?? "");
        setTotalPages(bookData.total_pages?.toString() ?? "");
        setRating(bookData.rating ?? 0);
        setOneLiner(bookData.one_liner ?? "");

        // 컨텍스트 상태 확인
        if (bookData.context_status === "done" && bookData.context_data) {
          setContextStatus("done");
        } else if (bookData.context_status === "failed") {
          setContextStatus("failed");
        } else if (!contextStartedRef.current) {
          contextStartedRef.current = true;

          if (bookData.context_status === "fetching") {
            // setup에서 이미 시작됨 → 폴링으로 대기
            setContextStatus("fetching");
          } else {
            // 아직 시작 안 됨 → API 호출 + 폴링
            setContextStatus("fetching");
            fetchWithAuth("/api/book-context", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: bookData.title,
                author: bookData.author,
                bookId,
              }),
            }).catch(() => {});
          }

          // 2초 간격 폴링: context_status가 done/failed 될 때까지
          pollRef.current = setInterval(async () => {
            const { data: check } = await supabase
              .from("books")
              .select("context_data, context_status")
              .eq("id", bookId)
              .single();

            if (check?.context_status === "done" && check.context_data) {
              setContextStatus("done");
              setBook((prev) =>
                prev
                  ? { ...prev, context_data: check.context_data, context_status: "done" }
                  : prev,
              );
              if (pollRef.current) clearInterval(pollRef.current);
            } else if (check?.context_status === "failed") {
              setContextStatus("failed");
              if (pollRef.current) clearInterval(pollRef.current);
            }
          }, 2000);
        }
      }

      setIsLoading(false);
    }

    load();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [bookId]);

  const saveField = useCallback(
    async (updates: Partial<Book>) => {
      try {
        const updated = await updateBook(supabaseRef.current, bookId, updates);
        setBook(updated);
        toast.success("저장했어요");
      } catch {
        toast.error("저장에 실패했어요");
      }
    },
    [bookId],
  );

  /* ── Event handlers ── */

  function handleStatusChange(newStatus: ReadingStatus) {
    if (newStatus === "abandoned") {
      setShowAbandonDialog(true);
      return;
    }
    const updates: Partial<Book> = { reading_status: newStatus };
    const today = new Date().toISOString().split("T")[0];

    if (newStatus === "reading" && !book?.started_at) {
      updates.started_at = today;
    }
    if (newStatus === "finished" && !book?.finished_at) {
      updates.finished_at = today;
    }
    // 중단 → 읽는 중 재개 시 abandoned_at 초기화
    if (newStatus === "reading" && book?.reading_status === "abandoned") {
      updates.abandoned_at = null;
      updates.abandon_note = null;
    }

    saveField(updates);
  }

  function handlePageBlur(field: "current_page" | "total_pages", value: string) {
    const num = value === "" ? null : parseInt(value, 10);
    if (isNaN(num as number) && num !== null) return;
    saveField({ [field]: num });
  }

  function handleDateChange(field: "started_at" | "finished_at", value: string) {
    saveField({ [field]: value || null });
  }

  function handleRatingChange(v: number) {
    setRating(v);
    saveField({ rating: v });
  }

  function handleOneLinerBlur() {
    if (oneLiner !== (book?.one_liner ?? "")) {
      saveField({ one_liner: oneLiner || null });
    }
  }

  async function handleDeleteBook() {
    setDeleting(true);
    try {
      await deleteBook(supabaseRef.current, bookId);
      toast.success("책을 삭제했어요");
      router.push("/");
    } catch {
      toast.error("삭제에 실패했어요");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  /* ── Loading / Not found ── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <p className="text-warmgray text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-paper gap-3">
        <p className="text-warmgray text-sm">책을 찾을 수 없어요</p>
        <button
          onClick={() => router.push("/")}
          className="bg-ink-green text-paper rounded-btn px-4 py-2 text-sm font-semibold"
        >
          서재로 돌아가기
        </button>
      </div>
    );
  }

  const phase = PHASES[book.phase] ?? PHASES[0];
  const phaseIndex = getPhaseIndex(messages.length);
  const showProgress = book.reading_status === "reading" || book.reading_status === "finished";
  const progressPercent =
    book.current_page && book.total_pages && book.total_pages > 0
      ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100))
      : 0;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "scraps", label: "✏️스크랩", count: scraps.length },
    { key: "discussion", label: "💬토론", count: messages.length },
    { key: "review", label: "✍️서평" },
  ];

  return (
    <div className="min-h-screen bg-paper pb-24">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-10 bg-paper/90 backdrop-blur-sm border-b border-[rgba(43,76,63,0.08)]">
        <div className="flex items-center gap-3 px-4 h-12">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-btn hover:bg-ink-green/5 active:bg-ink-green/10"
          >
            <ArrowLeft className="w-5 h-5 text-ink-green" />
          </button>
          <h1 className="text-sm font-semibold text-ink-green truncate flex-1">
            책 정보
          </h1>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-9 h-9 flex items-center justify-center rounded-btn hover:bg-red-50 active:bg-red-100"
          >
            <Trash2 className="w-4.5 h-4.5 text-warmgray hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* ── Book info card ── */}
      <div className="px-4 pt-5">
        <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
          <div className="flex gap-4">
            {/* Cover */}
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={book.title}
                className="w-24 h-36 object-cover rounded-lg flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-36 rounded-lg flex items-center justify-center flex-shrink-0 bg-ink-green/10">
                <span className="text-4xl">{phase.icon}</span>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h2 className="text-lg font-black text-ink leading-tight">
                {book.title}
              </h2>
              {book.author && (
                <p className="text-sm text-warmgray mt-1">{book.author}</p>
              )}

              {/* Status dropdown */}
              <select
                value={book.reading_status}
                onChange={(e) => handleStatusChange(e.target.value as ReadingStatus)}
                className="mt-3 text-sm bg-warm border border-[rgba(43,76,63,0.08)] rounded-btn px-2.5 py-1.5 text-ink-green font-medium w-fit focus:outline-none focus:ring-1 focus:ring-ink-green/20"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Want to Read Info ── */}
      {book.reading_status === "want_to_read" && (book.want_memo || book.recommended_by) && (
        <div className="px-4 mt-3">
          <div className="bg-[#C4A35A]/5 rounded-card border border-[#C4A35A]/20 p-4">
            {book.want_memo && (
              <p className="text-sm text-ink leading-relaxed mb-2">
                💭 {book.want_memo}
              </p>
            )}
            {book.recommended_by && (
              <p className="text-xs text-warmgray">
                👤 {book.recommended_by}님의 추천
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Abandoned Info ── */}
      {book.reading_status === "abandoned" && (
        <div className="px-4 mt-3">
          <div className="bg-terra/5 rounded-card border border-terra/20 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-terra font-semibold">
                📕 {book.abandoned_at ? `${new Date(book.abandoned_at).toLocaleDateString("ko")} 중단` : "중단됨"}
              </p>
              <button
                onClick={() => handleStatusChange("reading")}
                className="text-xs text-ink-green font-semibold hover:underline"
              >
                다시 읽기
              </button>
            </div>
            {book.abandon_note && (
              <p className="text-sm text-ink mt-2 leading-relaxed">
                &ldquo;{book.abandon_note}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Page Progress ── */}
      {showProgress && (
        <div className="px-4 mt-3">
          <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
            {/* Progress bar */}
            <div className="w-full h-2 bg-ink-green/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-ink-green rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-warmgray mt-2">
              p.{book.current_page ?? 0} / {book.total_pages ?? "?"}
            </p>

            {/* Page inputs */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => setCurrentPage(e.target.value)}
                onBlur={() => handlePageBlur("current_page", currentPage)}
                placeholder="현재"
                className="w-20 text-sm bg-paper border border-[rgba(43,76,63,0.08)] rounded-btn px-2 py-1 text-ink text-center focus:outline-none focus:ring-1 focus:ring-ink-green/20"
              />
              <span className="text-warmgray text-sm">/</span>
              <input
                type="number"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                onBlur={() => handlePageBlur("total_pages", totalPages)}
                placeholder="전체"
                className="w-20 text-sm bg-paper border border-[rgba(43,76,63,0.08)] rounded-btn px-2 py-1 text-ink text-center focus:outline-none focus:ring-1 focus:ring-ink-green/20"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Dates row ── */}
      <div className="px-4 mt-3">
        <div className="flex gap-3">
          <div className="flex-1 bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-3">
            <p className="text-[11px] text-warmgray mb-1">시작</p>
            <input
              type="date"
              value={book.started_at ?? ""}
              onChange={(e) => handleDateChange("started_at", e.target.value)}
              className="w-full text-sm text-ink bg-transparent focus:outline-none"
            />
            {!book.started_at && (
              <span className="text-sm text-warmgray/50">&mdash;</span>
            )}
          </div>
          <div className="flex-1 bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-3">
            <p className="text-[11px] text-warmgray mb-1">완독</p>
            <input
              type="date"
              value={book.finished_at ?? ""}
              onChange={(e) => handleDateChange("finished_at", e.target.value)}
              className="w-full text-sm text-ink bg-transparent focus:outline-none"
            />
            {!book.finished_at && (
              <span className="text-sm text-warmgray/50">&mdash;</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Context Preparation Banner ── */}
      {contextStatus === "fetching" && (
        <div className="px-4 mt-3">
          <div className="bg-warm rounded-card border border-ink-green/20 shadow-card p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl animate-bounce">😊</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink-green">방긋이 토론을 준비 중이에요</p>
                <p className="text-xs text-warmgray mt-0.5">웹에서 책 정보를 모으고 있어요</p>
              </div>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-ink-green/50 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-ink-green/50 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 bg-ink-green/50 rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
            {/* Step indicators (from context_data.steps during fetching) */}
            {(() => {
              const steps = book?.context_data?.steps;
              if (!steps) return null;
              const stepIcon = (s: string) => s === "success" ? "✅" : s === "warning" ? "⚠️" : s === "failed" ? "❌" : s === "pending" ? "⏳" : "⬜";
              return (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-warmgray">
                  <span>{stepIcon(steps.plot)} 줄거리</span>
                  <span>{stepIcon(steps.characters)} 등장인물</span>
                  <span>{stepIcon(steps.reviews)} 서평</span>
                  <span>{stepIcon(steps.grok)} SNS</span>
                  <span>{stepIcon(steps.structure)} 정리</span>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {contextStatus === "failed" && (
        <div className="px-4 mt-3">
          <div className="bg-warm rounded-card border border-terra/20 shadow-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">😥</span>
                <p className="text-sm text-terra font-medium">준비에 실패했어요</p>
              </div>
              <button
                onClick={() => {
                  if (!book) return;
                  setContextStatus("fetching");
                  fetchWithAuth("/api/book-context", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: book.title, author: book.author, bookId }),
                  }).catch(() => {});
                  if (pollRef.current) clearInterval(pollRef.current);
                  pollRef.current = setInterval(async () => {
                    const { data: check } = await supabaseRef.current
                      .from("books")
                      .select("context_data, context_status")
                      .eq("id", bookId)
                      .single();
                    if (check?.context_status === "done" && check.context_data) {
                      setContextStatus("done");
                      setBook((prev) =>
                        prev ? { ...prev, context_data: check.context_data, context_status: "done" } : prev,
                      );
                      if (pollRef.current) clearInterval(pollRef.current);
                    } else if (check?.context_status === "failed") {
                      setContextStatus("failed");
                      setBook((prev) =>
                        prev ? { ...prev, context_data: check.context_data, context_status: "failed" } : prev,
                      );
                      if (pollRef.current) clearInterval(pollRef.current);
                    }
                  }, 2000);
                }}
                className="text-xs text-terra font-semibold bg-terra/10 px-3 py-1.5 rounded-btn hover:bg-terra/20"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="px-4 mt-5">
        <div className="flex border-b border-[rgba(43,76,63,0.08)]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-sm font-semibold py-2.5 transition-all ${
                activeTab === tab.key
                  ? "border-b-2 border-ink-green text-ink-green"
                  : "text-warmgray"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 text-[11px] bg-ink-green/10 text-ink-green rounded-full px-1.5 py-0.5">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-4 mt-4">
        {activeTab === "scraps" && (
          <ScrapTab
            scraps={scraps}
            bookId={bookId}
            bookTitle={book.title}
            userId={user?.id ?? ""}
            onAdd={(scrap) => setScraps((prev) => [scrap, ...prev])}
          />
        )}
        {activeTab === "discussion" && (
          <DiscussionTab
            bookId={bookId}
            messages={messages}
            scrapsCount={scraps.length}
            phaseIndex={phaseIndex}
            contextStatus={contextStatus}
            contextData={book?.context_data}
          />
        )}
        {activeTab === "review" && (
          <ReviewTab
            bookId={bookId}
            review={review}
            rating={rating}
            oneLiner={oneLiner}
            onRatingChange={handleRatingChange}
            onOneLinerChange={setOneLiner}
            onOneLinerBlur={handleOneLinerBlur}
          />
        )}
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-paper rounded-card shadow-lg p-6 w-full max-w-xs text-center">
            <p className="text-base font-semibold text-ink mb-2">책을 삭제할까요?</p>
            <p className="text-xs text-warmgray mb-5">
              토론 내역, 스크랩, 서평이 모두 삭제돼요.
              <br />이 작업은 되돌릴 수 없어요.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-btn border border-warmgray/30 text-warmgray text-sm font-semibold py-2.5 hover:bg-warmgray/5"
              >
                취소
              </button>
              <button
                onClick={handleDeleteBook}
                disabled={deleting}
                className="flex-1 rounded-btn bg-red-500 text-paper text-sm font-semibold py-2.5 hover:bg-red-500/90 disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Abandon Dialog ── */}
      {showAbandonDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-paper rounded-card shadow-lg p-6 w-full max-w-xs">
            <p className="text-base font-semibold text-ink mb-2 text-center">독서를 중단할까요?</p>
            <p className="text-xs text-warmgray mb-4 text-center">나중에 다시 &quot;읽는 중&quot;으로 재개할 수 있어요.</p>
            <textarea
              value={abandonNote}
              onChange={(e) => setAbandonNote(e.target.value)}
              placeholder="한줄평 (선택)"
              rows={2}
              maxLength={200}
              className="w-full bg-warm border border-[rgba(43,76,63,0.15)] rounded-btn px-3 py-2.5 text-sm text-ink resize-none mb-4 focus:outline-none focus:ring-1 focus:ring-ink-green/30"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAbandonDialog(false); setAbandonNote(""); }}
                className="flex-1 rounded-btn border border-warmgray/30 text-warmgray text-sm font-semibold py-2.5 hover:bg-warmgray/5"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  saveField({
                    reading_status: "abandoned",
                    abandoned_at: today,
                    abandon_note: abandonNote.trim() || null,
                  });
                  setShowAbandonDialog(false);
                  setAbandonNote("");
                }}
                className="flex-1 rounded-btn bg-terra text-paper text-sm font-semibold py-2.5 hover:bg-terra/90"
              >
                중단하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Scrap Tab ═══════════════════════ */

function ScrapTab({
  scraps,
  bookId,
  bookTitle,
  userId,
  onAdd,
}: {
  scraps: Scrap[];
  bookId: string;
  bookTitle: string;
  userId: string;
  onAdd: (scrap: Scrap) => void;
}) {
  const supabaseRef = useRef(createClient());
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const scrap = await createScrap(supabaseRef.current, {
        user_id: userId,
        book_id: bookId,
        text: text.trim(),
        memo: memo.trim() || null,
        book_title: bookTitle,
        book_author: null,
        page_number: pageNumber ? parseInt(pageNumber, 10) : null,
        source: capturedImage ? "camera" : "manual",
      });
      onAdd(scrap);
      setText("");
      setPageNumber("");
      setMemo("");
      setShowForm(false);
      toast.success("글귀를 저장했어요");
    } catch {
      toast.error("저장에 실패했어요");
    } finally {
      setSaving(false);
    }
  }

  function handleCamera(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setCapturedImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      if (base64) handleHighlightOCR(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleHighlightOCR(base64: string) {
    setOcrLoading(true);
    try {
      const res = await fetchWithAuth("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mode: "highlight" }),
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
        toast.success("하이라이트 문장을 추출했어요!");
      } else {
        toast.error("하이라이트를 인식하지 못했어요");
        setShowForm(true);
      }
    } catch {
      toast.error("OCR 처리에 실패했어요");
      setShowForm(true);
    }
    setOcrLoading(false);
  }

  async function handleCrop(croppedBase64: string) {
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
  }

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

      <div className="space-y-2.5">
        {/* Add button + camera button */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex-1 text-sm font-semibold text-ink-green bg-ink-green/5 border border-dashed border-ink-green/20 rounded-card py-3 hover:bg-ink-green/10 transition-colors"
          >
            + 글귀 추가
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={ocrLoading}
            className="w-12 flex items-center justify-center text-ink-green bg-ink-green/5 border border-dashed border-ink-green/20 rounded-card hover:bg-ink-green/10 transition-colors disabled:opacity-50"
            title="카메라 촬영"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            disabled={ocrLoading}
            className="w-12 flex items-center justify-center text-[#C4A35A] bg-[#C4A35A]/5 border border-dashed border-[#C4A35A]/20 rounded-card hover:bg-[#C4A35A]/10 transition-colors disabled:opacity-50"
            title="캡처에서 하이라이트 추출"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCamera}
            className="hidden"
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            onChange={handleGallery}
            className="hidden"
          />
        </div>

        {/* OCR Loading */}
        {ocrLoading && (
          <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4 text-center text-sm text-warmgray">
            형광펜 친 부분을 텍스트로 변환 중...
          </div>
        )}

        {/* Inline form */}
        {showForm && (
          <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4 space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="마음에 드는 문장을 적어보세요"
              rows={3}
              className="w-full text-sm text-ink bg-paper border border-[rgba(43,76,63,0.08)] rounded-btn px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ink-green/20"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={pageNumber}
                onChange={(e) => setPageNumber(e.target.value)}
                placeholder="페이지"
                className="w-24 text-sm bg-paper border border-[rgba(43,76,63,0.08)] rounded-btn px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-ink-green/20"
              />
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모 (선택)"
                className="flex-1 text-sm bg-paper border border-[rgba(43,76,63,0.08)] rounded-btn px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-ink-green/20"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={!text.trim() || saving}
              className="w-full bg-ink-green text-paper text-sm font-semibold py-2.5 rounded-btn hover:bg-ink-green/90 transition-colors disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        )}

        {/* Scrap list */}
        {scraps.length === 0 && !showForm && (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">✏️</div>
            <p className="text-warmgray text-sm">아직 글귀가 없어요</p>
            <p className="text-warmgray/60 text-xs mt-1">
              마음에 드는 문장을 기록해보세요
            </p>
          </div>
        )}

        {scraps.map((s) => (
          <div
            key={s.id}
            className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4"
          >
            <p className="text-sm text-ink leading-relaxed" style={{ fontFamily: "serif" }}>
              &ldquo;{s.text}&rdquo;
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              {s.page_number && (
                <>
                  <span className="text-xs text-warmgray">
                    p.{s.page_number}
                  </span>
                  <span className="text-warmgray/40">&middot;</span>
                </>
              )}
              {s.memo && (
                <>
                  <span className="text-xs text-warmgray italic truncate max-w-[60%]">
                    {s.memo}
                  </span>
                  <span className="text-warmgray/40">&middot;</span>
                </>
              )}
              <span className="text-[11px] text-warmgray/60">
                {format(new Date(s.created_at), "M/d", { locale: ko })}
              </span>
              {s.source === "camera" && (
                <>
                  <span className="text-warmgray/40">&middot;</span>
                  <Camera className="w-3 h-3 text-warmgray/50" />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════ Discussion Tab ═══════════════════════ */

function DiscussionTab({
  bookId,
  messages,
  scrapsCount,
  phaseIndex,
  contextStatus,
  contextData,
}: {
  bookId: string;
  messages: Message[];
  scrapsCount: number;
  phaseIndex: number;
  contextStatus: string | null;
  contextData: Record<string, unknown> | null;
}) {
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  async function handleSummary() {
    if (summaryLoading) return;
    setSummaryLoading(true);
    try {
      const res = await fetchWithAuth("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (!res.ok) throw new Error("summary failed");
      const data = await res.json();
      setSummaryText(data.summary);
    } catch {
      toast.error("요약을 불러오지 못했어요");
    } finally {
      setSummaryLoading(false);
    }
  }

  if (messages.length === 0) {
    const quality = (contextData?.quality as string) || null;
    const found = (contextData?.found as { plot?: boolean; characters?: boolean; themes?: boolean }) || {};
    const isSufficient = contextStatus === "done" && quality === "sufficient";
    const isPartial = contextStatus === "done" && quality === "partial";
    const isFetching = contextStatus === "fetching";

    // 스크랩 메시지
    const scrapMessage = scrapsCount === 0
      ? null
      : scrapsCount <= 2
      ? "글귀가 더 있으면 더 깊은 토론이 가능해요"
      : scrapsCount <= 4
      ? `글귀가 ${scrapsCount}개! 토론을 시작해볼까요?`
      : "문장 수준까지 파고들 수 있어요";

    return (
      <div className="text-center py-12">
        <div className="text-3xl mb-3">💬</div>
        {isSufficient ? (
          <>
            <p className="text-ink-green text-sm font-semibold mb-1">준비 완료!</p>
            <div className="flex justify-center gap-2 text-xs text-warmgray mb-3">
              <span>{found.plot ? "✅" : "❌"} 줄거리</span>
              <span>{found.characters ? "✅" : "❌"} 등장인물</span>
              <span>{found.themes ? "✅" : "❌"} 독자 반응</span>
            </div>
            {scrapMessage && (
              <p className="text-sm text-[#C4A35A] mb-4">{scrapMessage}</p>
            )}
            <Link
              href={`/discuss/${bookId}`}
              className="inline-flex items-center gap-2 bg-ink-green text-paper text-sm font-semibold px-5 py-2.5 rounded-btn hover:bg-ink-green/90 transition-colors"
            >
              토론 시작하기
            </Link>
          </>
        ) : isPartial ? (
          <>
            <p className="text-[#C4A35A] text-sm font-semibold mb-1">일부 정보 부족, 토론은 가능해요</p>
            <div className="flex justify-center gap-2 text-xs text-warmgray mb-3">
              <span>{found.plot ? "✅" : "⚠️"} 줄거리</span>
              <span>{found.characters ? "✅" : "⚠️"} 등장인물</span>
              <span>{found.themes ? "✅" : "⚠️"} 독자 반응</span>
            </div>
            {scrapMessage && (
              <p className="text-sm text-[#C4A35A] mb-4">{scrapMessage}</p>
            )}
            <Link
              href={`/discuss/${bookId}`}
              className="inline-flex items-center gap-2 bg-ink-green text-paper text-sm font-semibold px-5 py-2.5 rounded-btn hover:bg-ink-green/90 transition-colors"
            >
              토론 시작하기
            </Link>
          </>
        ) : isFetching ? (
          <>
            <p className="text-warmgray text-sm mb-2">방긋이 토론을 준비 중이에요</p>
            <p className="text-xs text-warmgray/70">웹에서 책 정보를 모으고 있어요</p>
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 bg-warmgray/10 text-warmgray text-sm font-semibold px-5 py-2.5 rounded-btn cursor-not-allowed">
                토론 준비 중...
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="text-terra text-sm font-semibold mb-1">정보가 부족해요</p>
            <div className="flex justify-center gap-2 text-xs text-warmgray mb-3">
              <span>❌ 줄거리</span>
              <span>❌ 등장인물</span>
              <span>❌ 독자 반응</span>
            </div>
            <p className="text-xs text-warmgray/70 mb-4">글귀를 추가하면 토론이 더 풍부해져요</p>
            <Link
              href={`/discuss/${bookId}`}
              className="inline-flex items-center gap-2 bg-warmgray/20 text-warmgray text-sm font-semibold px-5 py-2.5 rounded-btn hover:bg-warmgray/30 transition-colors"
            >
              그래도 토론 시작하기
            </Link>
          </>
        )}
      </div>
    );
  }

  const lastMessages = messages.slice(-3);

  return (
    <div className="space-y-3">
      {/* Phase progress dots */}
      <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
        <div className="flex items-center justify-between relative mb-3">
          {/* Connecting line */}
          <div className="absolute top-3 left-6 right-6 h-0.5 bg-ink-green/10" />
          <div
            className="absolute top-3 left-6 h-0.5 transition-all duration-500 bg-ink-green"
            style={{
              width: `${(phaseIndex / (PHASES.length - 1)) * 100}%`,
              maxWidth: "calc(100% - 48px)",
            }}
          />
          {PHASES.map((p, i) => (
            <div key={p.id} className="flex flex-col items-center z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 transition-all ${
                  i <= phaseIndex
                    ? "border-transparent bg-ink-green text-paper"
                    : "border-ink-green/20 bg-paper text-warmgray"
                }`}
              >
                {i <= phaseIndex ? p.icon : <span className="text-[10px]">{i + 1}</span>}
              </div>
              <span
                className={`text-[10px] mt-1.5 font-medium ${
                  i <= phaseIndex ? "text-ink-green" : "text-warmgray"
                }`}
              >
                {p.label}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-warmgray mb-3">{messages.length}턴</p>

        {/* Summary button */}
        <button
          onClick={handleSummary}
          disabled={summaryLoading}
          className="w-full text-sm font-medium text-[#C4A35A] bg-[#C4A35A]/10 border border-[#C4A35A]/20 rounded-btn py-2 mb-2 hover:bg-[#C4A35A]/15 transition-colors disabled:opacity-50"
        >
          {summaryLoading ? "요약 중..." : "토론 요약 보기"}
        </button>

        {/* Summary result */}
        {summaryText && (
          <div className="bg-paper rounded-btn border border-[rgba(43,76,63,0.08)] p-3 mb-2">
            <p className="text-xs font-semibold text-ink-green mb-1.5">토론 요약</p>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
              {summaryText}
            </p>
          </div>
        )}

        <Link
          href={`/discuss/${bookId}?resume=1`}
          className="w-full inline-flex items-center justify-center gap-2 bg-ink-green text-paper text-sm font-semibold px-5 py-2.5 rounded-btn hover:bg-ink-green/90 transition-colors"
        >
          💬 이어서 토론하기
        </Link>

        {/* Full conversation link */}
        <Link
          href={`/discuss/${bookId}`}
          className="block text-center text-xs text-warmgray mt-2 hover:text-ink-green transition-colors"
        >
          전체 대화 보기 &rarr;
        </Link>
      </div>

      {/* Last 3 messages preview */}
      <div className="space-y-2">
        <p className="text-xs text-warmgray font-medium px-1">최근 대화</p>
        {lastMessages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-card p-3 ${
              msg.role === "user"
                ? "bg-ink-green/5 ml-6"
                : "bg-warm border border-[rgba(43,76,63,0.08)] mr-6"
            }`}
          >
            <p className="text-xs text-ink leading-relaxed line-clamp-3">
              {msg.content}
            </p>
            <span className="text-[10px] text-warmgray/50 mt-1.5 block">
              {msg.role === "user" ? "나" : "방긋"} &middot;{" "}
              {format(new Date(msg.created_at), "M/d", { locale: ko })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════ Review Tab ═══════════════════════ */

function ReviewTab({
  bookId,
  review,
  rating,
  oneLiner,
  onRatingChange,
  onOneLinerChange,
  onOneLinerBlur,
}: {
  bookId: string;
  review: Review | null;
  rating: number;
  oneLiner: string;
  onRatingChange: (v: number) => void;
  onOneLinerChange: (v: string) => void;
  onOneLinerBlur: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Star rating + one-liner (always editable) */}
      <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
        <p className="text-xs text-warmgray font-medium mb-2">별점</p>
        <StarRating value={rating} onChange={onRatingChange} />

        <p className="text-xs text-warmgray font-medium mt-4 mb-2">한줄평</p>
        <div className="relative">
          <textarea
            value={oneLiner}
            onChange={(e) => {
              if (e.target.value.length <= 50) onOneLinerChange(e.target.value);
            }}
            onBlur={onOneLinerBlur}
            placeholder="이 책을 한 문장으로..."
            rows={1}
            maxLength={50}
            className="w-full text-sm text-ink bg-paper border border-[rgba(43,76,63,0.08)] rounded-btn px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ink-green/20"
          />
          <span className="absolute bottom-2 right-3 text-[11px] text-warmgray/50">
            {oneLiner.length}/50
          </span>
        </div>
      </div>

      {/* Review content */}
      {review ? (
        <>
          {/* Radar chart for diagnosis */}
          {review.diagnosis && review.diagnosis.dimensions.length > 0 && (
            <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
              <p className="text-xs font-semibold text-ink-green mb-3">독서 진단</p>
              <RadarChart diagnosis={review.diagnosis} />
              {review.diagnosis.summary && (
                <p className="text-sm text-ink leading-relaxed mt-3 whitespace-pre-wrap">
                  {review.diagnosis.summary}
                </p>
              )}
            </div>
          )}

          {/* Review body */}
          <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-ink-green">
                {review.mode === "structured" ? "구조 서평" : "에세이 서평"}
              </p>
              {/* Public / Private indicator */}
              <div className="flex items-center gap-1 text-xs text-warmgray">
                {review.is_public ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>공개</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>비공개</span>
                  </>
                )}
              </div>
            </div>

            {review.mode === "structured" && "oneliner" in review.content && (
              <p className="text-sm font-semibold text-ink-green mb-2">
                &ldquo;{(review.content as { oneliner: string }).oneliner}&rdquo;
              </p>
            )}

            {review.mode === "structured" && "keywords" in review.content && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(review.content as { keywords: string[] }).keywords.map(
                  (kw, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-[#C4A35A]/15 text-[#C4A35A] font-medium px-2 py-0.5 rounded-badge"
                    >
                      #{kw}
                    </span>
                  ),
                )}
              </div>
            )}

            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
              {(review.content as { body: string }).body}
            </p>

            {/* Edit button */}
            <Link
              href={`/review/${bookId}`}
              className="inline-flex items-center justify-center w-full mt-4 text-sm font-semibold text-ink-green bg-ink-green/5 border border-ink-green/20 rounded-btn py-2.5 hover:bg-ink-green/10 transition-colors"
            >
              수정하기
            </Link>
          </div>
        </>
      ) : (
        <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4 text-center">
          <p className="text-sm text-warmgray mb-4">
            토론을 마치면 AI 서평을 받을 수 있어요
          </p>
          <Link
            href={`/review/${bookId}`}
            className="inline-flex items-center gap-2 bg-ink-green text-paper text-sm font-semibold px-5 py-2.5 rounded-btn hover:bg-ink-green/90 transition-colors"
          >
            서평 쓰기
          </Link>
        </div>
      )}
    </div>
  );
}
