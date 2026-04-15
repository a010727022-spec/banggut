"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  getBook,
  getMessages,
  getReview,
  upsertReview,
  updateBook,
  upsertStreak,
} from "@/lib/supabase/queries";
import type { Book, Message, Diagnosis } from "@/lib/types";
import { track, EVENTS } from "@/lib/analytics";
import { countMeaningfulTurns, REQUIRED_MEANINGFUL_TURNS } from "@/lib/meaningful-turns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Sparkles, Save, Eye, EyeOff, Check, Undo2, X, Lock, Share2 } from "lucide-react";
import { toast } from "sonner";
import ShareCard from "@/components/shared/ShareCard";
import { shareReviewCard } from "@/lib/share-utils";

/* ───── localStorage 임시저장 유틸 ───── */

const DRAFT_PREFIX = "banggut_review_draft_";

interface ReviewDraft {
  mode: "essay" | "structured";
  essayBody: string;
  oneliner: string;
  keywords: string;
  target: string;
  structuredBody: string;
  isPublic: boolean;
  diagnosis: Diagnosis | null;
  savedAt: number;
}

function getDraftKey(bookId: string) {
  return `${DRAFT_PREFIX}${bookId}`;
}

function saveDraftToLocal(bookId: string, draft: ReviewDraft) {
  try {
    localStorage.setItem(getDraftKey(bookId), JSON.stringify(draft));
  } catch {
    // storage full 등 무시
  }
}

function loadDraftFromLocal(bookId: string): ReviewDraft | null {
  try {
    const raw = localStorage.getItem(getDraftKey(bookId));
    if (!raw) return null;
    return JSON.parse(raw) as ReviewDraft;
  } catch {
    return null;
  }
}

function clearDraftFromLocal(bookId: string) {
  try {
    localStorage.removeItem(getDraftKey(bookId));
  } catch {
    // 무시
  }
}

/* ───── 자동저장 상태 텍스트 ───── */

function SaveStatus({ status, savedAt }: { status: "idle" | "saving" | "saved" | "error"; savedAt: number | null }) {
  if (status === "idle" && !savedAt) return null;

  const getTimeAgo = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 10) return "방금";
    if (diff < 60) return `${diff}초 전`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    return `${Math.floor(diff / 3600)}시간 전`;
  };

  return (
    <span className="text-[11px] text-warmgray flex items-center gap-1">
      {status === "saving" && "저장 중"}
      {status === "saved" && savedAt && (
        <>
          <Check className="w-3 h-3 text-ink-green" />
          자동저장됨 · {getTimeAgo(savedAt)}
        </>
      )}
      {status === "error" && (
        <span className="text-[#B86B4A]">저장 실패</span>
      )}
      {status === "idle" && savedAt && (
        <>
          <Check className="w-3 h-3 text-ink-green" />
          자동저장됨 · {getTimeAgo(savedAt)}
        </>
      )}
    </span>
  );
}

/* ───── AI 초안 선택 바텀시트 ───── */

function AIDraftSheet({
  onAppend,
  onReplace,
  onCancel,
}: {
  onAppend: () => void;
  onReplace: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="relative w-full max-w-lg bg-paper rounded-t-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] space-y-3"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-ink">AI 초안 적용 방식</h3>
          <button onClick={onCancel} className="text-warmgray p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-warmgray">기존에 작성한 내용이 있어요. 어떻게 할까요?</p>
        <button
          onClick={onAppend}
          className="w-full text-left bg-warm rounded-card border border-[rgba(43,76,63,0.1)] p-4 hover:border-ink-green/30 transition-colors"
        >
          <p className="text-sm font-semibold text-ink">✍️ 기존 내용 뒤에 이어 붙이기</p>
          <p className="text-xs text-warmgray mt-1">내가 쓴 글 아래에 AI 초안이 추가돼요</p>
        </button>
        <button
          onClick={onReplace}
          className="w-full text-left bg-warm rounded-card border border-[rgba(43,76,63,0.1)] p-4 hover:border-ink-green/30 transition-colors"
        >
          <p className="text-sm font-semibold text-ink">🤖 AI 초안으로 새로 시작하기</p>
          <p className="text-xs text-warmgray mt-1">기존 내용을 대체해요 (되돌리기 가능)</p>
        </button>
      </div>
    </div>
  );
}

/* ───── AI 초안 미리보기 패널 ───── */

function AIDraftPreview({
  draft,
  mode,
  onAppend,
  onReplace,
  onClose,
}: {
  draft: { body?: string; oneliner?: string; keywords?: string[]; target?: string };
  mode: "essay" | "structured";
  onAppend: () => void;
  onReplace: () => void;
  onClose: () => void;
}) {
  const previewText = mode === "essay"
    ? draft.body || ""
    : [
        draft.oneliner && `한줄평: ${draft.oneliner}`,
        draft.keywords?.length && `키워드: ${draft.keywords.join(", ")}`,
        draft.target && `추천 대상: ${draft.target}`,
        draft.body && `\n${draft.body}`,
      ].filter(Boolean).join("\n");

  return (
    <div className="bg-ink-green/5 border border-ink-green/20 rounded-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-green">🤖 AI 초안 미리보기</h3>
        <button onClick={onClose} className="text-warmgray p-1 hover:text-ink">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="bg-paper rounded-btn p-3 mb-3 max-h-48 overflow-y-auto">
        <p className="text-sm text-ink leading-body whitespace-pre-wrap">{previewText}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onAppend}
          className="flex-1 text-sm font-semibold text-ink-green py-2 rounded-btn border border-ink-green/20 hover:bg-ink-green/5 transition-colors"
        >
          ✍️ 이어 붙이기
        </button>
        <button
          onClick={onReplace}
          className="flex-1 text-sm font-semibold text-paper bg-ink-green py-2 rounded-btn hover:bg-ink-medium transition-colors"
        >
          🤖 대체하기
        </button>
      </div>
    </div>
  );
}

/* ───── 메인 컴포넌트 ───── */

export default function ReviewPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [book, setBook] = useState<Book | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"essay" | "structured">("essay");
  const [essayBody, setEssayBody] = useState("");
  const [oneliner, setOneliner] = useState("");
  const [keywords, setKeywords] = useState("");
  const [target, setTarget] = useState("");
  const [structuredBody, setStructuredBody] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [generating, setGenerating] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // 공유 관련
  const [showShareCard, setShowShareCard] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  // 자동저장 상태
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<number | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataLoadedRef = useRef(false);
  const hasUnsavedRef = useRef(false);

  // AI 초안 관련
  const [showDraftSheet, setShowDraftSheet] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingAIDraft, setPendingAIDraft] = useState<any>(null);
  const [showAIPreview, setShowAIPreview] = useState(false);
  // 이전 버전 복원
  const [previousVersion, setPreviousVersion] = useState<{
    essayBody: string;
    oneliner: string;
    keywords: string;
    target: string;
    structuredBody: string;
  } | null>(null);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 유의미한 턴 수 계산
  const meaningfulTurns = useMemo(() => countMeaningfulTurns(messages), [messages]);
  const canUseAI = meaningfulTurns >= REQUIRED_MEANINGFUL_TURNS;
  const turnsRemaining = Math.max(0, REQUIRED_MEANINGFUL_TURNS - meaningfulTurns);

  // 현재 draft 스냅샷
  const getCurrentDraft = useCallback((): ReviewDraft => ({
    mode,
    essayBody,
    oneliner,
    keywords,
    target,
    structuredBody,
    isPublic,
    diagnosis,
    savedAt: Date.now(),
  }), [mode, essayBody, oneliner, keywords, target, structuredBody, isPublic, diagnosis]);

  // 내용이 비어있는지 체크
  const hasContent = useCallback(() => {
    if (mode === "essay") return essayBody.trim().length > 0;
    return oneliner.trim().length > 0 || structuredBody.trim().length > 0;
  }, [mode, essayBody, oneliner, structuredBody]);

  /* ───── 자동저장: localStorage (즉시) + Supabase (debounce 2초) ───── */

  const saveToSupabase = useCallback(async () => {
    if (!user || !bookId || !hasContent()) return;
    setSaveStatus("saving");
    try {
      const supabase = createClient();
      const content =
        mode === "essay"
          ? { body: essayBody }
          : {
              oneliner,
              keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
              target,
              body: structuredBody,
            };
      await upsertReview(supabase, {
        book_id: bookId,
        user_id: user.id,
        mode,
        content,
        diagnosis,
        is_public: isPublic,
      });
      setSaveStatus("saved");
      setLastSavedAt(Date.now());
      hasUnsavedRef.current = false;
    } catch {
      setSaveStatus("error");
    }
  }, [user, bookId, mode, essayBody, oneliner, keywords, target, structuredBody, isPublic, diagnosis, hasContent]);

  const scheduleAutoSave = useCallback(() => {
    if (!dataLoadedRef.current) return;
    hasUnsavedRef.current = true;

    if (bookId) {
      saveDraftToLocal(bookId, getCurrentDraft());
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveToSupabase();
    }, 2000);
  }, [bookId, getCurrentDraft, saveToSupabase]);

  useEffect(() => {
    scheduleAutoSave();
  }, [mode, essayBody, oneliner, keywords, target, structuredBody, isPublic, diagnosis]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───── beforeunload 경고 ───── */

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current && hasContent()) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasContent]);

  /* ───── 자동저장 상태 텍스트 갱신 ───── */

  useEffect(() => {
    if (!lastSavedAt) return;
    const interval = setInterval(() => {
      setLastSavedAt((prev) => prev);
    }, 30000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  /* ───── 데이터 로드: DB → localStorage 폴백 ───── */

  useEffect(() => {
    if (!bookId || !user) return;
    setLoadError(false);
    const supabase = createClient();
    const load = async () => {
      try {
        const [b, msgs, existingReview] = await Promise.all([
          getBook(supabase, bookId),
          getMessages(supabase, bookId),
          getReview(supabase, bookId),
        ]);
        if (b) setBook(b);
        setMessages(msgs);

        if (existingReview) {
          setMode(existingReview.mode);
          setIsPublic(existingReview.is_public);
          setDiagnosis(existingReview.diagnosis);
          const c = existingReview.content as unknown as Record<string, unknown>;
          if (existingReview.mode === "essay") {
            setEssayBody((c.body as string) || "");
          } else {
            setOneliner((c.oneliner as string) || "");
            setKeywords(((c.keywords as string[]) || []).join(", "));
            setTarget((c.target as string) || "");
            setStructuredBody((c.body as string) || "");
          }

          const localDraft = loadDraftFromLocal(bookId);
          const dbTime = new Date(existingReview.created_at).getTime();
          if (localDraft && localDraft.savedAt > dbTime) {
            setDraftTimestamp(localDraft.savedAt);
            setShowDraftBanner(true);
          } else {
            clearDraftFromLocal(bookId);
          }
        } else {
          const localDraft = loadDraftFromLocal(bookId);
          if (localDraft && (localDraft.essayBody || localDraft.oneliner || localDraft.structuredBody)) {
            setDraftTimestamp(localDraft.savedAt);
            setShowDraftBanner(true);
          }
        }

        setTimeout(() => { dataLoadedRef.current = true; }, 100);
      } catch {
        setLoadError(true);
      }
    };
    load();
  }, [bookId, user]);

  /* ───── 로컬 draft 복구 ───── */

  const restoreDraft = () => {
    if (!bookId) return;
    const draft = loadDraftFromLocal(bookId);
    if (!draft) return;
    setMode(draft.mode);
    setEssayBody(draft.essayBody);
    setOneliner(draft.oneliner);
    setKeywords(draft.keywords);
    setTarget(draft.target);
    setStructuredBody(draft.structuredBody);
    setIsPublic(draft.isPublic);
    if (draft.diagnosis) setDiagnosis(draft.diagnosis);
    setShowDraftBanner(false);
    toast.success("임시저장을 복구했어요");
  };

  const dismissDraft = () => {
    if (bookId) clearDraftFromLocal(bookId);
    setShowDraftBanner(false);
  };

  /* ───── 이전 버전 복원 (Undo) ───── */

  const saveCurrentAsSnapshot = () => {
    setPreviousVersion({
      essayBody,
      oneliner,
      keywords,
      target,
      structuredBody,
    });
  };

  const restorePreviousVersion = () => {
    if (!previousVersion) return;
    setEssayBody(previousVersion.essayBody);
    setOneliner(previousVersion.oneliner);
    setKeywords(previousVersion.keywords);
    setTarget(previousVersion.target);
    setStructuredBody(previousVersion.structuredBody);
    setPreviousVersion(null);
    setShowUndoBanner(false);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    toast.success("이전 내용으로 복원했어요");
  };

  const showUndoOption = () => {
    setShowUndoBanner(true);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    // 15초 후 자동 숨김
    undoTimerRef.current = setTimeout(() => {
      setShowUndoBanner(false);
    }, 15000);
  };

  /* ───── AI 초안 적용 ───── */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyDraftAppend = (draft: any) => {
    saveCurrentAsSnapshot();
    if (mode === "essay") {
      const separator = essayBody.trim() ? "\n\n---\n\n" : "";
      setEssayBody(essayBody + separator + (draft.body || ""));
    } else {
      if (!oneliner && draft.oneliner) setOneliner(draft.oneliner);
      if (!keywords && draft.keywords) setKeywords((draft.keywords || []).join(", "));
      if (!target && draft.target) setTarget(draft.target);
      const separator = structuredBody.trim() ? "\n\n---\n\n" : "";
      setStructuredBody(structuredBody + separator + (draft.body || ""));
    }
    setShowAIPreview(false);
    setPendingAIDraft(null);
    showUndoOption();
    toast.success("AI 초안을 이어 붙였어요");
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyDraftReplace = (draft: any) => {
    saveCurrentAsSnapshot();
    if (mode === "essay") {
      setEssayBody(draft.body || "");
    } else {
      setOneliner(draft.oneliner || "");
      setKeywords((draft.keywords || []).join(", "));
      setTarget(draft.target || "");
      setStructuredBody(draft.body || "");
    }
    setShowAIPreview(false);
    setPendingAIDraft(null);
    showUndoOption();
    toast.success("AI 초안으로 대체했어요");
  };

  /* ───── AI 초안 생성 ───── */

  const generateDraft = async () => {
    if (!canUseAI) {
      toast.error(`유의미한 토론 ${turnsRemaining}턴이 더 필요해요`);
      return;
    }
    if (messages.length === 0) {
      toast.error("토론 내용이 없어요");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetchWithAuth("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          style: mode,
          bookInfo: `${book?.title} - ${book?.author}`,
        }),
      });
      if (res.status === 401) {
        toast.error("로그인이 필요해요");
        setGenerating(false);
        return;
      }
      const data = await res.json();
      if (!data.content) {
        toast.error("서평 생성에 실패했어요");
        setGenerating(false);
        return;
      }

      // 기존 내용이 있으면 → 바텀시트 or 미리보기
      if (hasContent()) {
        setPendingAIDraft(data.content);
        setShowDraftSheet(true);
      } else {
        // 기존 내용 없으면 바로 적용
        if (mode === "essay") {
          setEssayBody(data.content.body || "");
        } else {
          setOneliner(data.content.oneliner || "");
          setKeywords((data.content.keywords || []).join(", "));
          setTarget(data.content.target || "");
          setStructuredBody(data.content.body || "");
        }
        toast.success("초안이 생성되었어요");
      }
    } catch {
      toast.error("생성에 실패했어요");
    }
    setGenerating(false);
  };

  // 바텀시트에서 "이어 붙이기" 선택
  const handleSheetAppend = () => {
    setShowDraftSheet(false);
    // 미리보기 패널 표시
    setShowAIPreview(true);
  };

  // 바텀시트에서 "새로 시작" 선택
  const handleSheetReplace = () => {
    setShowDraftSheet(false);
    setShowAIPreview(true);
  };

  const runDiagnosis = async () => {
    if (messages.length === 0) {
      toast.error("토론 내용이 없어요");
      return;
    }
    setDiagnosing(true);
    try {
      const res = await fetchWithAuth("/api/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (res.status === 401) {
        toast.error("로그인이 필요해요");
        setDiagnosing(false);
        return;
      }
      const data = await res.json();
      if (!data.diagnosis) {
        toast.error("진단에 실패했어요");
        setDiagnosing(false);
        return;
      }
      setDiagnosis(data.diagnosis);
      toast.success("독서 진단이 완료되었어요");
    } catch {
      toast.error("진단에 실패했어요");
    }
    setDiagnosing(false);
  };

  /* ───── 공유하기 ───── */

  const handleShare = async () => {
    setShowShareCard(true);
    setSharing(true);

    // Wait for the card to render
    await new Promise((r) => setTimeout(r, 100));

    if (!shareCardRef.current) {
      toast.error("공유 카드를 생성할 수 없어요");
      setSharing(false);
      setShowShareCard(false);
      return;
    }

    try {
      const reviewOneliner = mode === "essay"
        ? essayBody.slice(0, 100)
        : oneliner || structuredBody.slice(0, 100);

      const result = await shareReviewCard({
        element: shareCardRef.current,
        bookTitle: book?.title || "",
        oneliner: reviewOneliner,
      });

      if (result === "shared") {
        toast.success("서평 카드를 공유했어요");
      } else if (result === "copied") {
        toast.success("서평 텍스트를 복사했어요");
      } else {
        toast.success("서평 카드 이미지가 저장되었어요");
      }
    } catch {
      toast.error("공유에 실패했어요");
    }

    setSharing(false);
    setShowShareCard(false);
  };

  /* ───── 최종 저장 ───── */

  const handleSave = async () => {
    if (!user || !bookId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const content =
        mode === "essay"
          ? { body: essayBody }
          : {
              oneliner,
              keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
              target,
              body: structuredBody,
            };
      await upsertReview(supabase, {
        book_id: bookId,
        user_id: user.id,
        mode,
        content,
        diagnosis,
        is_public: isPublic,
      });
      await updateBook(supabase, bookId, { has_review: true });
      track(EVENTS.REVIEW_SAVED, {
        book_id: bookId,
        mode,
        is_public: isPublic,
        has_diagnosis: !!diagnosis,
      });
      // 스트릭 기록
      if (user) upsertStreak(supabase, user.id, { review: true }).catch(() => {});
      clearDraftFromLocal(bookId);
      hasUnsavedRef.current = false;
      toast.success("서평이 저장되었어요");
      router.push("/");
    } catch {
      toast.error("저장에 실패했어요");
    }
    setSaving(false);
  };

  /* ───── 언마운트 시 타이머 정리 ───── */

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <p className="text-warmgray text-sm mb-3">데이터를 불러오지 못했어요</p>
        <button onClick={() => window.location.reload()} className="text-sm text-ink-green font-semibold hover:underline">
          다시 시도
        </button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-screen text-warmgray text-sm">
        불러오는 중
      </div>
    );
  }

  const formatDraftTime = (ts: number) => {
    const d = new Date(ts);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${month}/${day} ${h}:${m}`;
  };

  return (
    <div className="px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      {/* Header + 자동저장 상태 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-ink-green">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-ink-green">✍️ 서평 쓰기</h1>
          <p className="text-xs text-warmgray">{book.title}</p>
        </div>
        <SaveStatus status={saveStatus} savedAt={lastSavedAt} />
      </div>

      {/* 임시저장 복구 배너 */}
      {showDraftBanner && (
        <div className="bg-[#C4A35A]/10 border border-[#C4A35A]/30 rounded-card p-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">임시저장된 글이 있어요</p>
            {draftTimestamp && (
              <p className="text-xs text-warmgray">{formatDraftTime(draftTimestamp)}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={dismissDraft}
              className="text-xs text-warmgray px-2 py-1 rounded hover:bg-black/5"
            >
              무시
            </button>
            <button
              onClick={restoreDraft}
              className="text-xs text-ink-green font-semibold px-2 py-1 rounded bg-ink-green/10 hover:bg-ink-green/20"
            >
              복구하기
            </button>
          </div>
        </div>
      )}

      {/* 되돌리기 배너 */}
      {showUndoBanner && previousVersion && (
        <div className="bg-ink-green/5 border border-ink-green/20 rounded-card p-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-ink">AI 초안이 적용되었어요</p>
          <button
            onClick={restorePreviousVersion}
            className="flex items-center gap-1.5 text-sm text-ink-green font-semibold px-3 py-1.5 rounded-btn bg-ink-green/10 hover:bg-ink-green/20 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            되돌리기
          </button>
        </div>
      )}

      {/* Diagnosis */}
      <div className="bg-warm rounded-card border border-[var(--bd)] shadow-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink-green">🔍 AI 독서 진단</h3>
          <Button
            onClick={runDiagnosis}
            disabled={diagnosing}
            variant="outline"
            size="sm"
            className="text-xs border-ink-green text-ink-green hover:bg-ink-green/5 rounded-btn"
          >
            {diagnosing ? "분석 중" : "진단하기"}
          </Button>
        </div>
        {!diagnosis && !diagnosing && (
          <p className="text-xs text-warmgray text-center py-3">토론 내용을 바탕으로 독서 역량을 분석해드려요</p>
        )}
        {diagnosis && (
          <div className="space-y-2">
            {diagnosis.dimensions.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <span className="text-xs w-20 text-warmgray">{d.label}</span>
                <div className="flex-1 h-2 bg-ink-green/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ink-green rounded-full transition-all"
                    style={{ width: `${(d.score / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-ink-green font-semibold w-4">{d.score}</span>
              </div>
            ))}
            {diagnosis.summary && (
              <p className="text-xs text-warmgray mt-2 leading-body">{diagnosis.summary}</p>
            )}
          </div>
        )}
      </div>

      {/* AI 초안 미리보기 패널 */}
      {showAIPreview && pendingAIDraft && (
        <AIDraftPreview
          draft={pendingAIDraft}
          mode={mode}
          onAppend={() => applyDraftAppend(pendingAIDraft)}
          onReplace={() => applyDraftReplace(pendingAIDraft)}
          onClose={() => { setShowAIPreview(false); setPendingAIDraft(null); }}
        />
      )}

      {/* Review Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "essay" | "structured")}>
        <TabsList className="w-full bg-ink-green/5 rounded-btn mb-4">
          <TabsTrigger value="essay" className="flex-1 text-sm rounded-btn data-[state=active]:bg-ink-green data-[state=active]:text-paper">
            에세이형
          </TabsTrigger>
          <TabsTrigger value="structured" className="flex-1 text-sm rounded-btn data-[state=active]:bg-ink-green data-[state=active]:text-paper">
            📋 구조형
          </TabsTrigger>
        </TabsList>

        <TabsContent value="essay">
          <Textarea
            value={essayBody}
            onChange={(e) => setEssayBody(e.target.value)}
            placeholder="자유롭게 서평을 작성해주세요..."
            rows={12}
            maxLength={5000}
            className="bg-warm border-[var(--bd2)] rounded-btn resize-none leading-body"
          />
        </TabsContent>

        <TabsContent value="structured" className="space-y-3">
          <Input
            value={oneliner}
            onChange={(e) => setOneliner(e.target.value)}
            placeholder="한줄평"
            maxLength={100}
            className="bg-warm border-[var(--bd2)] rounded-btn"
          />
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="키워드 (쉼표 구분)"
            maxLength={100}
            className="bg-warm border-[var(--bd2)] rounded-btn"
          />
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="추천 대상"
            maxLength={100}
            className="bg-warm border-[var(--bd2)] rounded-btn"
          />
          <Textarea
            value={structuredBody}
            onChange={(e) => setStructuredBody(e.target.value)}
            placeholder="본문 서평"
            rows={8}
            maxLength={3000}
            className="bg-warm border-[var(--bd2)] rounded-btn resize-none leading-body"
          />
        </TabsContent>
      </Tabs>

      {/* 서평 작성 방식 선택 */}
      <div className="mt-4 space-y-3">
        {/* 직접 쓰기 안내 - 입력 필드 위에 이미 있으므로 여기선 구분선 역할 */}

        {/* AI로 쓰기 버튼 + 진행 안내 */}
        <div className="bg-warm rounded-card border border-[var(--bd)] p-4 space-y-3">
          <Button
            onClick={generateDraft}
            disabled={generating || !canUseAI}
            variant="outline"
            className={`w-full rounded-btn h-10 ${
              canUseAI
                ? "border-ink-green text-ink-green hover:bg-ink-green/5"
                : "border-warmgray/30 text-warmgray cursor-not-allowed"
            }`}
          >
            {canUseAI ? (
              <Sparkles className="w-4 h-4 mr-2" />
            ) : (
              <Lock className="w-4 h-4 mr-2" />
            )}
            {generating
              ? "생성 중"
              : canUseAI
                ? "AI 초안 생성"
                : "AI로 쓰기 🔒"}
          </Button>

          {/* 진행 상황 표시 */}
          {!canUseAI && (
            <div className="text-center space-y-2">
              {/* 프로그레스 바 */}
              <div className="flex items-center gap-2">
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
              <p className="text-xs text-warmgray leading-relaxed">
                토론을 좀 더 나눈 후에 AI 서평을 쓸 수 있어요
                <br />
                <span className="text-ink-green font-semibold">{turnsRemaining}턴</span> 더 나누면 활성화돼요
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsPublic(!isPublic)}
            className="flex items-center gap-1.5 text-sm text-warmgray"
          >
            {isPublic ? (
              <Eye className="w-4 h-4 text-ink-green" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
            {isPublic ? "공개" : "비공개"}
          </button>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-ink-green text-paper hover:bg-ink-medium rounded-btn h-12 text-base font-semibold"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "저장 중" : "서평 저장"}
          </Button>
          <Button
            onClick={handleShare}
            disabled={sharing || (!essayBody && !oneliner && !structuredBody)}
            variant="outline"
            className="h-12 px-4 rounded-btn border-ink-green text-ink-green hover:bg-ink-green/5"
            title="공유하기"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Hidden ShareCard for image capture */}
      {showShareCard && (
        <div
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            zIndex: -1,
            pointerEvents: "none",
          }}
        >
          <ShareCard
            ref={shareCardRef}
            bookTitle={book?.title || ""}
            bookAuthor={book?.author || null}
            oneliner={
              mode === "essay"
                ? essayBody.slice(0, 100)
                : oneliner || structuredBody.slice(0, 100)
            }
            rating={book?.rating || null}
            nickname={user?.nickname || "독서가"}
            mode={mode}
          />
        </div>
      )}

      {/* AI 초안 선택 바텀시트 */}
      {showDraftSheet && pendingAIDraft && (
        <AIDraftSheet
          onAppend={handleSheetAppend}
          onReplace={handleSheetReplace}
          onCancel={() => { setShowDraftSheet(false); setPendingAIDraft(null); }}
        />
      )}
    </div>
  );
}
