"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getBook,
  getMessages,
  getScrapsByBook,
  createScrap,
  getReview,
  updateBook,
  deleteBook,
  deleteReview,
  upsertStreak,
} from "@/lib/supabase/queries";
import { BRANCHES } from "@/lib/types";
import type { Book, Message, Scrap, Review, ReadingStatus, Diagnosis } from "@/lib/types";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useAuthStore } from "@/stores/useAuthStore";
import Link from "next/link";
import { ArrowLeft, Star, Camera, Eye, EyeOff, Check, RotateCcw, X, Trash2, ImagePlus, Lock, Sparkles, Pencil, BookOpen, MessageCircle, PenLine, Highlighter } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { countMeaningfulTurns, REQUIRED_MEANINGFUL_TURNS } from "@/lib/meaningful-turns";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import dynamic from "next/dynamic";

const CompletionFlow = dynamic(() => import("@/components/CompletionFlow"), { ssr: false });

type Tab = "scraps" | "discussion" | "review";


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
            stroke="var(--bd)"
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
              stroke="var(--bd)"
              strokeWidth={0.8}
            />
          );
        })}

        {/* Data area */}
        <polygon
          points={dataPolygon}
          fill="var(--bd2)"
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
            fill="var(--ac)"
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
              fill="var(--ac)"
            >
              {lp.label}
            </text>
            <text
              x={lp.x}
              y={lp.y + 8}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[10px] font-bold"
              fill="var(--ac2)"
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
  const searchParams = useSearchParams();
  const supabaseRef = useRef(createClient());

  const user = useAuthStore((s) => s.user);

  const initialTab = (searchParams.get("tab") as Tab) || "scraps";
  const [book, setBook] = useState<Book | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(
    ["scraps", "discussion", "review"].includes(initialTab) ? initialTab : "scraps"
  );
  const [isLoading, setIsLoading] = useState(true);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showUndoComplete, setShowUndoComplete] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);

  // Abandon state
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const [abandonNote, setAbandonNote] = useState("");

  // Completion flow state
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);

  // "오늘 읽었어요" 모달
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [todayPageInput, setTodayPageInput] = useState("");

  // 꾹 누르기 완독
  const [isHolding, setIsHolding] = useState(false);
  const [holdDone, setHoldDone] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 100% 도달 확인
  const [show100Confirm, setShow100Confirm] = useState(false);

  // Context preparation state
  const [contextStatus, setContextStatus] = useState<"idle" | "fetching" | "done" | "failed">("idle");
  const contextStartedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Editable fields (local state for controlled inputs)
  const [currentPage, setCurrentPage] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [progressPercInput, setProgressPercInput] = useState("");
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
        setProgressPercInput(bookData.progress_percent?.toString() ?? "");
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

  const savingRef = useRef(false);
  const saveField = useCallback(
    async (updates: Partial<Book>) => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const updated = await updateBook(supabaseRef.current, bookId, updates);
        setBook(updated);
        if (!updates.reading_status) {
          toast.success("저장했어요", { duration: 1500 });
        }
        // 스트릭 기록 (페이지 업데이트 or 상태 변경)
        const userId = useAuthStore.getState().user?.id;
        if (userId && (updates.current_page != null || updates.progress_percent != null || updates.reading_status)) {
          const activity: Record<string, unknown> = { read: [updated.title] };
          // 종이책: 페이지 기록
          if (updates.current_page != null && updated.total_pages) {
            const prevPage = book?.current_page || 0;
            activity.books = [{
              bookId: updated.id,
              title: updated.title,
              coverUrl: updated.cover_url || "",
              startPage: prevPage,
              endPage: updates.current_page,
              totalPages: updated.total_pages,
              completed: updated.reading_status === "finished",
              format: "paper",
            }];
          }
          // 전자책: 퍼센트 기록
          if (updates.progress_percent != null) {
            const prevPct = book?.progress_percent || 0;
            activity.books = [{
              bookId: updated.id,
              title: updated.title,
              coverUrl: updated.cover_url || "",
              startPercent: prevPct,
              endPercent: updates.progress_percent,
              completed: updated.reading_status === "finished",
              format: "ebook",
            }];
          }
          upsertStreak(supabaseRef.current, userId, activity).catch(() => {});
        }
      } catch {
        toast.error("저장에 실패했어요", { duration: 2000 });
      } finally {
        savingRef.current = false;
      }
    },
    [bookId, book?.current_page, book?.progress_percent, book?.reading_status],
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
      // 기본값: 서재 추가일
      updates.started_at = book?.created_at
        ? new Date(book.created_at).toISOString().split("T")[0]
        : today;
    }
    if (newStatus === "finished") {
      if (!book?.finished_at) updates.finished_at = today;
      // 읽은 기간 계산
      const startDate = book?.started_at || book?.created_at;
      if (startDate) {
        const start = new Date(startDate);
        const end = new Date(today);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        updates.reading_days = Math.max(days, 1);
      }
      // 완독 플로우는 저장 후 표시
      setTimeout(() => setShowCompletionFlow(true), 600);
    }
    // 중단 → 읽는 중 재개 시 abandoned_at 초기화
    if (newStatus === "reading" && book?.reading_status === "abandoned") {
      updates.abandoned_at = null;
      updates.abandon_note = null;
    }

    saveField(updates);
  }

  function handlePageBlur(field: "current_page" | "total_pages" | "progress_percent", value: string) {
    const num = value === "" ? null : parseInt(value, 10);
    if (isNaN(num as number) && num !== null) return;
    if (field === "progress_percent" && num !== null) {
      const clamped = Math.max(0, Math.min(100, num));
      saveField({ progress_percent: clamped });
      return;
    }
    saveField({ [field]: num });
  }

  function handleFormatChange(fmt: "paper" | "ebook") {
    saveField({ format: fmt });
  }

  function handleDateChange(field: "started_at" | "finished_at", value: string) {
    saveField({ [field]: value || null });
  }

  function handleRatingChange(v: number) {
    setRating(v);
    saveField({ rating: v });
  }

  function handleTodayRead(val: string) {
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    const isEb = book?.format === "ebook";
    if (isEb) {
      const clamped = Math.max(0, Math.min(100, num));
      saveField({ progress_percent: clamped });
      setProgressPercInput(String(clamped));
      if (clamped >= 100) {
        setShowTodayModal(false);
        setTimeout(() => setShow100Confirm(true), 400);
        return;
      }
    } else {
      saveField({ current_page: num });
      setCurrentPage(String(num));
      if (book?.total_pages && num >= book.total_pages) {
        setShowTodayModal(false);
        setTimeout(() => setShow100Confirm(true), 400);
        return;
      }
    }
    setShowTodayModal(false);
    toast.success("기록했어요", { duration: 1500 });

    // 90% 알림
    const pct = isEb ? num : (book?.total_pages ? Math.round(num / book.total_pages * 100) : 0);
    if (pct >= 90 && pct < 100) {
      setTimeout(() => toast("거의 다 왔어요", { duration: 2000 }), 800);
    }
  }

  function handleConfirm100() {
    setShow100Confirm(false);
    handleStatusChange("finished");
  }

  // 꾹 누르기
  function startHold() {
    if (holdDone) return;
    setIsHolding(true);
    navigator.vibrate?.([30]);
    holdTimerRef.current = setTimeout(() => {
      setHoldDone(true);
      setIsHolding(false);
      navigator.vibrate?.([50, 30, 50, 30, 200]);
      setTimeout(() => handleStatusChange("finished"), 300);
    }, 2000);
  }
  function endHold() {
    if (holdDone) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    setIsHolding(false);
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

  const showProgress = book.reading_status === "reading" || book.reading_status === "finished";
  const isEbook = book.format === "ebook";
  const progressPercent = isEbook
    ? (book.progress_percent || 0)
    : (book.current_page && book.total_pages && book.total_pages > 0
      ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100))
      : 0);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "scraps", label: "스크랩", count: scraps.length },
    { key: "discussion", label: "토론", count: messages.length },
    { key: "review", label: "서평" },
  ];

  const startedDaysAgo = book.started_at
    ? Math.max(1, Math.ceil((Date.now() - new Date(book.started_at).getTime()) / 86400000))
    : 0;

  const statusBadge = book.reading_status === "reading"
    ? { cls: "reading", label: "읽는 중", bg: "rgba(107,158,138,0.85)", color: "#091a10" }
    : book.reading_status === "finished"
    ? { cls: "done", label: "완독", bg: "rgba(40,160,100,0.88)", color: "#02120a" }
    : book.reading_status === "want_to_read"
    ? { cls: "wish", label: "위시", bg: "rgba(200,160,48,0.85)", color: "#1a1000" }
    : { cls: "abandoned", label: "중단", bg: "var(--sf3)", color: "var(--tm)" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 100, transition: "background 0.4s" }}>

      {/* ═══ HERO (HTML .book-hero, 280px) ═══ */}
      <div style={{ position: "relative", height: 280, overflow: "hidden" }}>
        {book.cover_url && (
          <img src={book.cover_url} alt="" style={{ position: "absolute", inset: -20, width: "calc(100% + 40px)", height: "calc(100% + 40px)", objectFit: "cover", filter: "blur(30px) brightness(0.25)", opacity: 0.7 }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--bg) 0%, rgba(12,15,13,0.55) 50%, rgba(12,15,13,0.35) 100%)", transition: "background 0.4s" }} />

        {/* 상단 네비 */}
        <div style={{ position: "absolute", top: 14, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", zIndex: 10 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.42)", backdropFilter: "blur(12px)", border: "0.5px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ArrowLeft size={16} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.42)", backdropFilter: "blur(12px)", border: "0.5px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2.2}><circle cx={18} cy={5} r={3}/><circle cx={6} cy={12} r={3}/><circle cx={18} cy={19} r={3}/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.42)", backdropFilter: "blur(12px)", border: "0.5px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2.2}><circle cx={12} cy={12} r={1}/><circle cx={19} cy={12} r={1}/><circle cx={5} cy={12} r={1}/></svg>
            </button>
          </div>
        </div>

        {/* 모임 필 */}
        {book.group_book_id && (
          <div style={{ position: "absolute", top: 58, left: 18, zIndex: 10, display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(12px)", border: "0.5px solid rgba(107,158,138,0.38)", borderRadius: 100, padding: "5px 11px", fontSize: 10, fontWeight: 800, color: "var(--ac2)", cursor: "pointer" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "pulseDot 1.4s infinite" }} />
            {book.group_books?.reading_groups?.name || "모임"}
          </div>
        )}

        {/* 플로팅 표지 (88x126) */}
        <div style={{ position: "absolute", bottom: 20, left: 20, zIndex: 5, width: 88, height: 126, borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {book.cover_url ? (
            <img src={book.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "var(--sf2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>{book.title.slice(0, 6)}</span>
            </div>
          )}
        </div>

        {/* 히어로 정보 */}
        <div style={{ position: "absolute", bottom: 20, left: 124, right: 20, zIndex: 5 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 100, fontSize: 9, fontWeight: 800, marginBottom: 8, backdropFilter: "blur(8px)", background: statusBadge.bg, color: statusBadge.color }}>
            <BookOpen size={10} strokeWidth={2.5} />
            {statusBadge.label}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", lineHeight: 1.2, textShadow: "0 2px 12px rgba(0,0,0,0.6)", marginBottom: 4 }}>{book.title}</div>
          {book.author && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{book.author}</div>}
        </div>
      </div>

      {/* ═══ 퀵 액션 (HTML .qa-row) ═══ */}
      {book.reading_status === "reading" && (
        <div style={{ display: "flex", gap: 8, padding: "14px 18px 10px" }}>
          <button onClick={() => {
            setTodayPageInput(String(book.current_page || 0));
            setShowTodayModal(true);
          }} style={{ flex: 1, padding: "10px 0", borderRadius: 12, background: "var(--ac)", color: "var(--acc)", border: "0.5px solid var(--ac)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            진행률 업데이트
          </button>
          <button onClick={() => setActiveTab("scraps")} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "0.5px solid var(--bd2)", background: "var(--sf)", fontSize: 12, fontWeight: 700, color: "var(--ac2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }}>
            <PenLine size={14} strokeWidth={2.5} />
            문장 긋기
          </button>
          <button onClick={() => setActiveTab("review")} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "0.5px solid var(--bd2)", background: "var(--sf)", fontSize: 12, fontWeight: 700, color: "var(--ac2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }}>
            <PenLine size={14} strokeWidth={2.5} />
            서평 쓰기
          </button>
        </div>
      )}

      {/* ═══ 진행률 섹션 (HTML .prog-section) ═══ */}
      {book.reading_status === "reading" && (
        <div style={{ margin: "4px 18px 12px", background: "var(--sf)", borderRadius: 16, border: "0.5px solid var(--bd)", overflow: "hidden", transition: "all 0.4s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 14px 10px" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--tm)", letterSpacing: "1px", textTransform: "uppercase", transition: "color 0.4s" }}>나의 진행률</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "var(--ac)", letterSpacing: "-1px", transition: "color 0.4s" }}>{progressPercent}%</span>
          </div>
          <div style={{ height: 6, background: "var(--sf3)", borderRadius: 3, overflow: "hidden", margin: "0 14px", transition: "background 0.4s" }}>
            <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, var(--ac), var(--ac2))", width: `${progressPercent}%`, transition: "width 0.6s cubic-bezier(0.22,1,0.36,1), background 0.4s" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "0.5px solid var(--bd)", marginTop: 10, transition: "border-color 0.4s" }}>
            <div style={{ padding: "10px 0", textAlign: "center", borderRight: "0.5px solid var(--bd)", transition: "border-color 0.4s" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.5px", transition: "color 0.4s" }}>{book.current_page || 0}<span style={{ fontSize: 9, fontWeight: 500, color: "var(--tm)", marginLeft: 1 }}>p</span></div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2, transition: "color 0.4s" }}>현재 페이지</div>
            </div>
            <div style={{ padding: "10px 0", textAlign: "center", borderRight: "0.5px solid var(--bd)", transition: "border-color 0.4s" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.5px", transition: "color 0.4s" }}>{book.total_pages || 0}<span style={{ fontSize: 9, fontWeight: 500, color: "var(--tm)", marginLeft: 1 }}>p</span></div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2, transition: "color 0.4s" }}>전체 페이지</div>
            </div>
            <div style={{ padding: "10px 0", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tp)", letterSpacing: "-0.5px", transition: "color 0.4s" }}>{startedDaysAgo}<span style={{ fontSize: 9, fontWeight: 500, color: "var(--tm)", marginLeft: 1 }}>일</span></div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--tm)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2, transition: "color 0.4s" }}>읽은 기간</div>
            </div>
          </div>
          {/* 슬라이더 업데이트 */}
          <div style={{ padding: "10px 14px", borderTop: "0.5px solid var(--bd)", transition: "border-color 0.4s" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tm)", marginBottom: 8, transition: "color 0.4s" }}>오늘 어디까지 읽었나요?</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="range" min={0} max={book.total_pages || 100}
                value={todayPageInput || book.current_page || 0}
                onChange={(e) => setTodayPageInput(e.target.value)}
                style={{ flex: 1, height: 4, appearance: "none", background: "var(--sf3)", borderRadius: 2, outline: "none", cursor: "pointer", accentColor: "var(--ac)" }} />
              <input type="text" value={todayPageInput}
                onChange={(e) => setTodayPageInput(e.target.value)}
                style={{ width: 52, background: "var(--sf2)", border: "0.5px solid var(--bd2)", borderRadius: 8, padding: "5px 8px", fontSize: 12, fontWeight: 700, color: "var(--tp)", textAlign: "center", outline: "none", transition: "all 0.4s" }} />
              <button onClick={() => {
                const val = parseInt(todayPageInput);
                if (!val || val <= 0) return;
                if (isEbook) saveField({ progress_percent: Math.min(val, 100) });
                else saveField({ current_page: Math.min(val, book.total_pages || 99999) });
              }} style={{ padding: "6px 14px", background: "var(--ac)", color: "var(--acc)", borderRadius: 100, fontSize: 11, fontWeight: 800, border: "none", cursor: "pointer", transition: "all 0.15s" }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Want to Read: 전용 상세 ── */}
      {book.reading_status === "want_to_read" && (
        <div className="px-4 mt-3">
          {/* 메인 버튼 */}
          <button
            onClick={() => setShowFormatPicker(true)}
            className="w-full py-4 rounded-2xl font-bold text-[15px] text-paper transition-all active:scale-[0.98] mb-4"
            style={{ background: "var(--c-forest, var(--ac))" }}
          >
            읽기 시작하기
          </button>

          {/* 내 메모 */}
          {(book.want_memo || book.recommended_by) && (
            <div style={{ padding: 14, borderRadius: 14, background: "var(--sf)", border: "1px solid var(--bd)", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tp)" }}>내 메모</span>
                <button onClick={() => {
                  const memo = prompt("메모 수정", book.want_memo || "");
                  if (memo !== null) saveField({ want_memo: memo || null });
                }} style={{ fontSize: 11, color: "var(--ts)" }}>수정</button>
              </div>
              {book.want_memo && <p style={{ fontSize: 13, color: "var(--tp)", lineHeight: 1.6 }}>{book.want_memo}</p>}
              {book.recommended_by && <p style={{ fontSize: 11, color: "var(--ts)", marginTop: 4 }}>{book.recommended_by}님의 추천</p>}
            </div>
          )}

          {/* 메모가 없을 때 추가 버튼 */}
          {!book.want_memo && !book.recommended_by && (
            <button
              onClick={() => {
                const memo = prompt("이 책을 담은 이유를 적어보세요");
                if (memo) saveField({ want_memo: memo });
              }}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "var(--sf)", border: "1px dashed var(--bd)", textAlign: "center", marginBottom: 12 }}
            >
              <p style={{ fontSize: 12, color: "var(--ts)" }}>메모 추가하기</p>
            </button>
          )}

          {/* 어디서 읽을 수 있어요 */}
          <div style={{ padding: 14, borderRadius: 14, background: "var(--sf)", border: "1px solid var(--bd)", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tp)", display: "block", marginBottom: 8 }}>어디서 읽을 수 있어요</span>
            <a
              href={`https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=${encodeURIComponent(book.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "var(--sf2)" }}
            >
              <BookOpen size={14} color="#5A7A52" strokeWidth={1.5} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tp)" }}>알라딘에서 찾기</span>
              <span style={{ fontSize: 11, color: "var(--ts)", marginLeft: "auto" }}>→</span>
            </a>
          </div>

          {/* 위시에서 삭제 */}
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ fontSize: 12, color: "var(--ts)" }}
            >위시에서 삭제</button>
          </div>
        </div>
      )}

      {/* ── 상태별 액션 버튼 ── */}
      {book.reading_status === "reading" && (
        <div className="px-4 mt-4 space-y-2">
          {/* 오늘 읽었어요 */}
          <button
            onClick={() => {
              setTodayPageInput(isEbook ? String(book.progress_percent || 0) : String(book.current_page || 0));
              setShowTodayModal(true);
            }}
            className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-paper transition-all active:scale-[0.98]"
            style={{ background: "var(--theme-deep, #2B4C3F)" }}
          >
            오늘 읽었어요
          </button>

          {/* 꾹 누르기 완독 */}
          <div>
            <button
              onMouseDown={startHold}
              onMouseUp={endHold}
              onMouseLeave={endHold}
              onTouchStart={startHold}
              onTouchEnd={endHold}
              onTouchCancel={endHold}
              className={`w-full py-3.5 rounded-2xl font-bold text-[15px] relative overflow-hidden select-none transition-transform ${
                holdDone ? "scale-105" : isHolding ? "scale-[1.03]" : ""
              }`}
              style={{
                background: holdDone ? "#C4A35A" : "transparent",
                color: holdDone ? "#fff" : "var(--theme-deep, #2B4C3F)",
                border: holdDone ? "none" : "2px solid var(--theme-deep, #2B4C3F)",
                touchAction: "none", WebkitUserSelect: "none",
              }}
            >
              <span className="relative z-10">{holdDone ? "✓ 완독!" : "다 읽었어요!"}</span>
              {/* fill bar */}
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: isHolding ? "100%" : "0%",
                background: "rgba(43,76,63,0.12)",
                transition: isHolding ? "width 2s linear" : "width 0.15s",
              }} />
              {/* ring SVG */}
              <svg viewBox="0 0 28 28" style={{
                position: "absolute", right: 16, top: "50%", transform: "translateY(-50%) rotate(-90deg)",
                width: 28, height: 28,
              }}>
                <circle cx="14" cy="14" r="12.5" fill="none"
                  stroke={holdDone ? "#fff" : "var(--theme-deep, #2B4C3F)"}
                  strokeWidth="2.5"
                  strokeDasharray="78.5"
                  strokeDashoffset={isHolding ? 0 : 78.5}
                  style={{ transition: isHolding ? "stroke-dashoffset 2s linear" : "stroke-dashoffset 0.15s" }}
                />
              </svg>
            </button>
            {!holdDone && (
              <p className={`text-center text-[11px] mt-1.5 transition-colors ${isHolding ? "text-ink-green font-medium" : "text-warmgray"}`}>
                {isHolding ? "누르고 있어요..." : "꾹 눌러서 완독하기"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 위시 읽기시작은 위 want_to_read 섹션에서 처리 */}

      {book.reading_status === "finished" && (
        <div className="px-4 mt-4">
          {/* 완독 정보 */}
          <div className="bg-[#C4A35A]/5 rounded-card border border-[#C4A35A]/15 p-4 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-[#C4A35A]">완독</span>
              {book.reading_days && <span className="text-xs text-warmgray">· {book.reading_days}일</span>}
              {(book.re_read_count ?? 0) > 0 && (
                <span className="text-xs text-warmgray">· {(book.re_read_count ?? 0) + 1}회독</span>
              )}
              {book.rating && (
                <span className="text-xs text-[#C4A35A]">
                  {"★".repeat(Math.floor(book.rating))}{"☆".repeat(5 - Math.floor(book.rating))}
                </span>
              )}
            </div>
            {book.one_liner && (
              <p className="text-sm text-ink leading-relaxed">&ldquo;{book.one_liner}&rdquo;</p>
            )}
          </div>

          {/* 다시 읽기 */}
          <button
            onClick={() => {
              // 현재 회독 기록을 history에 push
              const currentRound: import("@/lib/types").ReadingHistoryEntry = {
                round: (book.re_read_count ?? 0) + 1,
                started_at: book.started_at,
                finished_at: book.finished_at,
                reading_days: book.reading_days,
                rating: book.rating,
                one_line_review: book.one_liner,
                scrap_ids: scraps.map((s) => s.id),
              };
              const history = [...(book.reading_history || []), currentRound];
              saveField({
                reading_status: "reading" as const,
                current_page: 0,
                progress_percent: 0,
                started_at: new Date().toISOString().split("T")[0],
                finished_at: null,
                reading_days: null,
                re_read_count: (book.re_read_count ?? 0) + 1,
                reading_history: history,
              });
              toast.success("다시 읽기 시작", { duration: 2500 });
            }}
            className="w-full py-3 mb-2 rounded-xl font-semibold text-sm active:scale-[0.98] transition-all"
            style={{
              background: "var(--bg-primary, #F5F0EB)",
              color: "var(--tp)",
              border: "1px solid var(--bd)",
            }}
          >
            다시 읽기
          </button>

          <div className="space-y-2">
            <button
              onClick={() => router.push(`/discuss/${book.id}`)}
              className="w-full py-3 rounded-xl font-semibold text-sm text-paper active:scale-[0.98]"
              style={{ background: "var(--theme-deep, #2B4C3F)" }}
            >
              토론하기
            </button>
            <button
              onClick={() => router.push(`/review/${book.id}`)}
              className="w-full py-3 rounded-xl font-semibold text-sm border-2 active:scale-[0.98]"
              style={{ borderColor: "var(--theme-deep, #2B4C3F)", color: "var(--theme-deep, #2B4C3F)" }}
            >
              서평 쓰기
            </button>
            <button
              onClick={() => setShowCompletionFlow(true)}
              className="w-full py-3 rounded-xl font-semibold text-sm text-warmgray bg-ink/[0.04] active:scale-[0.98]"
            >
              완독 카드 공유
            </button>
          </div>

          {/* 지난 독서 히스토리 */}
          {(book.reading_history || []).length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p className="editorial-label" style={{ marginBottom: 10 }}>READING HISTORY</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...(book.reading_history || [])].reverse().map((h, i) => (
                  <div key={i} style={{
                    padding: 12, borderRadius: 12,
                    background: "var(--bg-primary, #F5F0EB)",
                    border: "1px solid var(--bd)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tp)" }}>
                        {h.round}회독
                      </span>
                      <span style={{ fontSize: 11, color: "var(--ts)" }}>
                        {h.reading_days ? `${h.reading_days}일` : ""}
                      </span>
                    </div>
                    {h.rating != null && h.rating > 0 && (
                      <span style={{ fontSize: 11, color: "#C4A35A" }}>
                        {"★".repeat(Math.floor(h.rating))}{"☆".repeat(5 - Math.floor(h.rating))}
                      </span>
                    )}
                    {h.one_line_review && (
                      <p style={{ fontSize: 12, color: "var(--ts)", marginTop: 4, lineHeight: 1.5, fontFamily: "'Noto Serif KR', serif" }}>
                        &ldquo;{h.one_line_review}&rdquo;
                      </p>
                    )}
                    <p style={{ fontSize: 10, color: "var(--ts)", marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                      {h.started_at?.slice(5).replace("-", ".")} — {h.finished_at?.slice(5).replace("-", ".")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 완독 취소 + 삭제 */}
          <div className="flex items-center justify-center gap-4 mt-6 pt-4" style={{ borderTop: "1px solid var(--bd)" }}>
            <button
              onClick={() => setShowUndoComplete(true)}
              className="text-xs text-warmgray hover:text-warmgray-light transition-colors"
            >
              완독 취소
            </button>
            <span className="text-warmgray-dim text-xs">·</span>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-warmgray hover:text-terra transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 완독 취소 확인 모달 */}
      {showUndoComplete && (
        <>
          <div onClick={() => setShowUndoComplete(false)} className="fixed inset-0 bg-black/30 z-50" />
          <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-50 bg-warm rounded-2xl p-6 shadow-soft max-w-sm mx-auto">
            <p className="text-sm font-semibold text-ink text-center mb-2">완독을 취소할까요?</p>
            <p className="text-xs text-warmgray text-center mb-5">읽는 중으로 돌아갑니다. 별점과 한줄평은 유지돼요.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUndoComplete(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-warmgray bg-ink/[0.04]"
              >취소</button>
              <button
                onClick={() => {
                  setShowUndoComplete(false);
                  saveField({
                    reading_status: "reading",
                    finished_at: null,
                    reading_days: null,
                  });
                  toast.success("읽는 중으로 돌렸어요", { duration: 1500 });
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-paper"
                style={{ background: "var(--theme-deep, #2B4C3F)" }}
              >되돌리기</button>
            </div>
          </div>
        </>
      )}

      {/* 종이책/전자책 선택 모달 */}
      {showFormatPicker && (
        <>
          <div onClick={() => setShowFormatPicker(false)} className="fixed inset-0 bg-black/30 z-50" />
          <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-50 bg-warm rounded-2xl p-6 shadow-soft max-w-sm mx-auto">
            <p className="text-sm font-semibold text-ink text-center mb-1">어떤 형태로 읽으세요?</p>
            <p className="text-xs text-warmgray text-center mb-5">나중에 변경할 수 있어요</p>
            <div className="flex gap-3">
              {([["paper", "종이책"], ["ebook", "전자책"]] as const).map(([fmt, label]) => (
                <button key={fmt} onClick={() => {
                  setShowFormatPicker(false);
                  saveField({
                    reading_status: "reading" as const, format: fmt,
                    started_at: new Date().toISOString().split("T")[0],
                    current_page: 0, progress_percent: 0,
                  });
                  toast.success("읽기 시작", { duration: 1500 });
                }}
                  className="flex-1 py-4 rounded-xl text-sm font-semibold active:scale-[0.97] transition-all"
                  style={{ background: "var(--sf2)", color: "var(--tp)", border: "1px solid var(--bd)" }}
                >{label}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {book.reading_status === "abandoned" && (
        <div className="px-4 mt-4 space-y-3">
          <div className="bg-terra/5 rounded-card border border-terra/20 p-4">
            <p className="text-xs text-terra font-semibold">
              {book.abandoned_at ? `${new Date(book.abandoned_at).toLocaleDateString("ko")} 중단` : "중단 중"}
            </p>
            {book.abandon_note && (
              <p className="text-sm text-ink mt-2 leading-relaxed">
                &ldquo;{book.abandon_note}&rdquo;
              </p>
            )}
          </div>
          <button
            onClick={() => handleStatusChange("reading")}
            className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-paper transition-all active:scale-[0.98]"
            style={{ background: "var(--theme-deep, #2B4C3F)" }}
          >
            다시 읽기
          </button>
        </div>
      )}

      {/* ── Page Progress ── */}
      {showProgress && (
        <div className="px-4 mt-3">
          <div className="bg-warm rounded-card border border-[var(--bd)] shadow-card p-4">
            {/* 종이책/전자책 토글 */}
            <div className="flex gap-1.5 mb-3">
              {([["paper", "종이책"], ["ebook", "전자책"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => handleFormatChange(val)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                    book.format === val
                      ? "bg-ink-green text-paper"
                      : "bg-ink/[0.04] text-warmgray hover:bg-ink/[0.08]"
                  }`}
                >{label}</button>
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-ink-green/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-ink-green rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {isEbook ? (
              <>
                <p className="text-xs text-warmgray mt-2">
                  {book.progress_percent ?? 0}% 읽음
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    value={progressPercInput}
                    onChange={(e) => setProgressPercInput(e.target.value)}
                    onBlur={() => handlePageBlur("progress_percent", progressPercInput)}
                    placeholder="진행률"
                    min="0" max="100"
                    className="w-20 text-sm bg-paper border border-[var(--bd)] rounded-btn px-2 py-1 text-ink text-center focus:outline-none focus:ring-1 focus:ring-ink-green/20"
                  />
                  <span className="text-warmgray text-sm">%</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-warmgray mt-2">
                  p.{book.current_page ?? 0} / {book.total_pages ?? "?"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    value={currentPage}
                    onChange={(e) => setCurrentPage(e.target.value)}
                    onBlur={() => handlePageBlur("current_page", currentPage)}
                    placeholder="현재"
                    className="w-20 text-sm bg-paper border border-[var(--bd)] rounded-btn px-2 py-1 text-ink text-center focus:outline-none focus:ring-1 focus:ring-ink-green/20"
                  />
                  <span className="text-warmgray text-sm">/</span>
                  <input
                    type="number"
                    value={totalPages}
                    onChange={(e) => setTotalPages(e.target.value)}
                    onBlur={() => handlePageBlur("total_pages", totalPages)}
                    placeholder="전체"
                    className="w-20 text-sm bg-paper border border-[var(--bd)] rounded-btn px-2 py-1 text-ink text-center focus:outline-none focus:ring-1 focus:ring-ink-green/20"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Dates row ── */}
      <div className="px-4 mt-3">
        <div className="flex gap-3">
          <div className="flex-1 bg-warm rounded-card border border-[var(--bd)] shadow-card p-3">
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
          <div className="flex-1 bg-warm rounded-card border border-[var(--bd)] shadow-card p-3">
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
              const stepIcon = (s: string) => s === "success" ? "O" : s === "warning" ? "-" : s === "failed" ? "X" : s === "pending" ? "-" : "-";
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
        <div className="flex border-b border-[var(--bd)]">
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
            contextStatus={contextStatus}
            contextData={book?.context_data}
          />
        )}
        {activeTab === "review" && (
          <ReviewTab
            bookId={bookId}
            review={review}
            messages={messages}
            rating={rating}
            oneLiner={oneLiner}
            onRatingChange={handleRatingChange}
            onOneLinerChange={setOneLiner}
            onOneLinerBlur={handleOneLinerBlur}
            onReviewDeleted={() => setReview(null)}
          />
        )}
      </div>

      {/* ── 하단 중단/삭제 링크 ── */}
      {(book.reading_status === "reading" || book.reading_status === "want_to_read") && (
        <div className="flex justify-center gap-6 mt-6 mb-4">
          {book.reading_status === "reading" && (
            <button
              onClick={() => setShowAbandonDialog(true)}
              className="text-xs text-warmgray hover:text-terra"
            >
              중단하기
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-warmgray hover:text-red-500"
          >
            삭제
          </button>
        </div>
      )}

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
              className="w-full bg-warm border border-[var(--bd2)] rounded-btn px-3 py-2.5 text-sm text-ink resize-none mb-4 focus:outline-none focus:ring-1 focus:ring-ink-green/30"
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

      {/* ── 오늘 읽었어요 바텀시트 ── */}
      {showTodayModal && book && (
        <>
          <div onClick={() => setShowTodayModal(false)} className="fixed inset-0 bg-black/30 z-50" />
          <div className="fixed bottom-0 left-0 right-0 z-[51] bg-paper rounded-t-[20px] shadow-lg"
            style={{ padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)" }}>
            <div className="flex justify-center mb-3">
              <div className="w-9 h-1 rounded bg-ink/10" />
            </div>
            <h3 className="text-base font-bold text-ink text-center mb-4">오늘 읽었어요!</h3>
            <p className="text-xs text-warmgray mb-2">
              {isEbook ? "어디까지 읽었어요?" : "지금 몇 페이지예요?"}
            </p>
            <div className="flex items-center gap-2 mb-5">
              <input
                type="number"
                value={todayPageInput}
                onChange={(e) => setTodayPageInput(e.target.value)}
                min={0}
                max={isEbook ? 100 : (book.total_pages || 9999)}
                autoFocus
                className="flex-1 text-center text-lg font-bold bg-ink-green/5 border border-ink-green/20 rounded-xl py-3 text-ink focus:outline-none focus:ring-2 focus:ring-ink-green/30"
              />
              <span className="text-sm text-warmgray font-medium">
                {isEbook ? "%" : `/ ${book.total_pages || "?"}p`}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // 건너뛰기: 페이지 안 바꾸고 스트릭만
                  const userId = useAuthStore.getState().user?.id;
                  if (userId) {
                    upsertStreak(supabaseRef.current, userId, { read: [book.title] }).catch(() => {});
                  }
                  setShowTodayModal(false);
                  toast.success("기록했어요", { duration: 1500 });
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-warmgray bg-ink/[0.04]"
              >
                건너뛰기
              </button>
              <button
                onClick={() => handleTodayRead(todayPageInput)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-paper"
                style={{ background: "var(--theme-deep, #2B4C3F)" }}
              >
                기록하기
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 100% 도달 확인 모달 ── */}
      {show100Confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-paper rounded-card shadow-lg p-6 w-full max-w-xs text-center">
            <p className="text-3xl mb-3">📖</p>
            <p className="text-base font-bold text-ink mb-4">혹시 다 읽으신 거예요?</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShow100Confirm(false);
                  toast.success("기록했어요", { duration: 1500 });
                }}
                className="flex-1 rounded-btn py-2.5 text-sm font-semibold text-warmgray bg-ink/[0.04]"
              >
                아직이요
              </button>
              <button
                onClick={handleConfirm100}
                className="flex-1 rounded-btn py-2.5 text-sm font-bold text-paper"
                style={{ background: "var(--theme-deep, #2B4C3F)" }}
              >
                다 읽었어요!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Completion Flow ── */}
      {showCompletionFlow && book && (
        <CompletionFlow
          book={book}
          scraps={scraps}
          onClose={() => setShowCompletionFlow(false)}
          onSave={(updates) => saveField(updates)}
          onNavigate={(path) => {
            setShowCompletionFlow(false);
            router.push(path);
          }}
        />
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
      toast.success("글귀를 저장했어요", { duration: 1500 });
      // 스트릭 기록
      upsertStreak(supabaseRef.current, userId, { scrap: true }).catch(() => {});
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
          <div className="bg-warm rounded-card border border-[var(--bd)] shadow-card p-4 text-center text-sm text-warmgray">
            형광펜 친 부분을 텍스트로 변환 중...
          </div>
        )}

        {/* Inline form */}
        {showForm && (
          <div className="bg-warm rounded-card border border-[var(--bd)] shadow-card p-4 space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="마음에 드는 문장을 적어보세요"
              rows={3}
              className="w-full text-sm text-ink bg-paper border border-[var(--bd)] rounded-btn px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ink-green/20"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={pageNumber}
                onChange={(e) => setPageNumber(e.target.value)}
                placeholder="페이지"
                className="w-24 text-sm bg-paper border border-[var(--bd)] rounded-btn px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-ink-green/20"
              />
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모 (선택)"
                className="flex-1 text-sm bg-paper border border-[var(--bd)] rounded-btn px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-ink-green/20"
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
          <EmptyState
            icon={Highlighter}
            title="아직 글귀가 없어요"
            description="마음에 드는 문장을 기록해보세요"
          />
        )}

        {scraps.map((s) => (
          <div
            key={s.id}
            className="bg-warm rounded-card border border-[var(--bd)] shadow-card p-4"
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
  contextStatus,
  contextData,
}: {
  bookId: string;
  messages: Message[];
  scrapsCount: number;
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
        <div className="mb-3"><MessageCircle size={28} color="#5A7A52" strokeWidth={1.5} /></div>
        {isSufficient ? (
          <>
            <p className="text-ink-green text-sm font-semibold mb-1">준비 완료!</p>
            <div className="flex justify-center gap-2 text-xs text-warmgray mb-3">
              <span>{found.plot ? "O" : "X"} 줄거리</span>
              <span>{found.characters ? "O" : "X"} 등장인물</span>
              <span>{found.themes ? "O" : "X"} 독자 반응</span>
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
              <span>{found.plot ? "O" : "-"} 줄거리</span>
              <span>{found.characters ? "O" : "-"} 등장인물</span>
              <span>{found.themes ? "O" : "-"} 독자 반응</span>
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
      {/* Branch summary + actions */}
      <div className="bg-warm rounded-card border border-[var(--bd)] shadow-card p-4">
        {/* Branch dots */}
        <div className="flex items-center gap-2 mb-3">
          {BRANCHES.map((b) => {
            const count = messages.filter((m) => m.branch === b.id).length;
            return (
              <div key={b.id} className="flex items-center gap-0.5">
                <span className="text-xs">{b.icon}</span>
                <div className="flex gap-[2px]">
                  {count > 0 ? (
                    Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-ink-green" />
                    ))
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-green/15" />
                  )}
                </div>
              </div>
            );
          })}
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
          <div className="bg-paper rounded-btn border border-[var(--bd)] p-3 mb-2">
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
          이어서 토론하기
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
                : "bg-warm border border-[var(--bd)] mr-6"
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
  messages,
  rating,
  oneLiner,
  onRatingChange,
  onOneLinerChange,
  onOneLinerBlur,
  onReviewDeleted,
}: {
  bookId: string;
  review: Review | null;
  messages: Message[];
  rating: number;
  oneLiner: string;
  onRatingChange: (v: number) => void;
  onOneLinerChange: (v: string) => void;
  onOneLinerBlur: () => void;
  onReviewDeleted: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const meaningfulTurns = countMeaningfulTurns(messages);
  const canUseAI = meaningfulTurns >= REQUIRED_MEANINGFUL_TURNS;
  const turnsRemaining = Math.max(0, REQUIRED_MEANINGFUL_TURNS - meaningfulTurns);

  const handleDeleteReview = async () => {
    setDeleting(true);
    try {
      const supabase = createClient();
      await deleteReview(supabase, bookId);
      await updateBook(supabase, bookId, { has_review: false });
      onReviewDeleted();
      setShowDeleteConfirm(false);
      toast.success("서평을 삭제했어요");
    } catch {
      toast.error("삭제에 실패했어요");
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-4">
      {/* Star rating + one-liner (always editable) */}
      <div className="bg-warm rounded-card border border-[var(--bd)] shadow-card p-4">
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
            className="w-full text-sm text-ink bg-paper border border-[var(--bd)] rounded-btn px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ink-green/20"
          />
          <span className="absolute bottom-2 right-3 text-[11px] text-warmgray/50">
            {oneLiner.length}/50
          </span>
        </div>
      </div>

      {/* ── 서평이 있을 때: 보기 + 수정/삭제 ── */}
      {review ? (
        <>
          {/* Radar chart for diagnosis */}
          {review.diagnosis && review.diagnosis.dimensions.length > 0 && (
            <div className="bg-warm rounded-card border border-[var(--bd)] shadow-card p-4">
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
          <div className="bg-warm rounded-card border border-[var(--bd)] shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-ink-green">
                {review.mode === "structured" ? "구조 서평" : "에세이 서평"}
              </p>
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

            <p className="text-[10px] text-warmgray mt-3">
              {new Date(review.created_at).toLocaleDateString("ko")} 작성
            </p>

            {/* 수정 / 삭제 버튼 */}
            <div className="flex gap-2 mt-4">
              <Link
                href={`/review/${bookId}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-green bg-ink-green/5 border border-ink-green/20 rounded-btn py-2.5 hover:bg-ink-green/10 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                수정하기
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-[#B86B4A] bg-[#B86B4A]/5 border border-[#B86B4A]/20 rounded-btn px-4 py-2.5 hover:bg-[#B86B4A]/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                삭제
              </button>
            </div>
          </div>

          {/* 삭제 확인 다이얼로그 */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
              <div className="bg-paper rounded-card shadow-lg p-6 w-full max-w-xs text-center">
                <p className="text-base font-semibold text-ink mb-2">이 서평을 삭제할까요?</p>
                <p className="text-xs text-warmgray mb-5">
                  삭제하면 되돌릴 수 없어요.
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
                    onClick={handleDeleteReview}
                    disabled={deleting}
                    className="flex-1 rounded-btn bg-[#B86B4A] text-paper text-sm font-semibold py-2.5 hover:bg-[#B86B4A]/90 disabled:opacity-50"
                  >
                    {deleting ? "삭제 중..." : "삭제하기"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── 서평이 없을 때: 직접 쓰기 + AI로 쓰기(조건부) ── */
        <div className="bg-warm rounded-card border border-[var(--bd)] shadow-card p-5 space-y-3">
          <p className="text-sm text-warmgray text-center mb-1">
            아직 서평을 쓰지 않았어요.
          </p>

          {/* 직접 쓰기 — 항상 활성화 */}
          <Link
            href={`/review/${bookId}`}
            className="flex items-center justify-center gap-2 w-full bg-ink-green text-paper text-sm font-semibold rounded-btn py-2.5 hover:bg-ink-green/90 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            직접 쓰기
          </Link>

          {/* AI로 쓰기 — 유의미한 토론 후에만 */}
          {canUseAI ? (
            <Link
              href={`/review/${bookId}?mode=ai`}
              className="flex items-center justify-center gap-2 w-full text-sm font-semibold text-ink-green border border-ink-green/20 rounded-btn py-2.5 hover:bg-ink-green/5 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              AI로 쓰기
            </Link>
          ) : (
            <div className="space-y-2">
              <button
                disabled
                className="flex items-center justify-center gap-2 w-full text-sm font-semibold text-warmgray border border-warmgray/20 rounded-btn py-2.5 cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                AI로 쓰기
              </button>
              <div className="text-center space-y-1.5">
                <div className="flex items-center gap-2 px-2">
                  <div className="flex-1 h-1.5 bg-ink-green/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ink-green/40 rounded-full transition-all duration-500"
                      style={{ width: `${(meaningfulTurns / REQUIRED_MEANINGFUL_TURNS) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-warmgray font-medium whitespace-nowrap">
                    {meaningfulTurns}/{REQUIRED_MEANINGFUL_TURNS}
                  </span>
                </div>
                <p className="text-xs text-warmgray">
                  토론을 좀 더 나눈 후에 AI 서평을 쓸 수 있어요
                  <br />
                  <span className="text-ink-green font-semibold">{turnsRemaining}턴</span> 더 나누면 활성화돼요
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
