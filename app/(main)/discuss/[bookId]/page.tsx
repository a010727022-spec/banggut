"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useDiscussionStore } from "@/stores/useDiscussionStore";
import {
  getBook,
  getBooks,
  getMessages,
  getUnderlines,
  getScrapsByBook,
  addMessage,
  createUnderline,
  upsertStreak,
} from "@/lib/supabase/queries";
import { BRANCHES, parseBranchTag } from "@/lib/types";
import type { Book, Message as MessageType } from "@/lib/types";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Send,
  PenLine,
  BookOpenCheck,
  WifiOff,
  RefreshCw,
  X,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

/* ───── 스트리밍 상태 타입 ───── */

type StreamPhase = "idle" | "connecting" | "searching" | "thinking" | "streaming" | "error";

/* ───── 연결 상태 배너 ───── */

function ConnectionBanner({
  phase,
  isOffline,
  onRetry,
  partialContent,
}: {
  phase: StreamPhase;
  isOffline: boolean;
  onRetry: () => void;
  partialContent: string;
}) {
  if (isOffline) {
    return (
      <div className="mx-4 mb-2 px-3 py-2 bg-[#B86B4A]/10 border border-[#B86B4A]/20 rounded-card flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-[#B86B4A] flex-shrink-0" />
        <p className="text-xs text-[#B86B4A] flex-1">인터넷 연결을 확인해주세요</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-4 mb-2 px-3 py-2 bg-[#B86B4A]/10 border border-[#B86B4A]/20 rounded-card flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-[#B86B4A] flex-shrink-0" />
        <p className="text-xs text-[#B86B4A] flex-1">
          {partialContent ? "연결이 끊겼어요. 일부 응답이 저장되었어요." : "연결이 끊겼어요."}
        </p>
        <button
          onClick={onRetry}
          className="flex items-center gap-1 text-xs text-[#B86B4A] font-semibold px-2 py-1 rounded-btn bg-[#B86B4A]/10 hover:bg-[#B86B4A]/20 transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-3 h-3" />
          다시 연결
        </button>
      </div>
    );
  }

  return null;
}

/* ───── 스트리밍 상태 인디케이터 ───── */

function StreamIndicator({ phase }: { phase: StreamPhase }) {
  if (phase === "idle" || phase === "error") return null;

  const config = {
    connecting: { text: "연결 중...", color: "bg-warmgray/40" },
    searching: { text: "자료를 찾는 중...", color: "bg-gold/60" },
    thinking: { text: "생각하는 중...", color: "bg-ink-green/40" },
    streaming: { text: "", color: "" },
  };

  const c = config[phase];
  if (!c || phase === "streaming") return null;

  return (
    <div className="flex justify-start">
      <div className="px-4 py-3 rounded-card bg-warm border border-[var(--bd)]">
        <span className="text-[10px] text-ink-muted font-semibold block mb-1">
          방긋
        </span>
        <p className="text-xs text-warmgray mb-2">{c.text}</p>
        <div className="flex gap-1.5">
          <span className={`w-1.5 h-1.5 ${c.color} rounded-full animate-bounce`} />
          <span className={`w-1.5 h-1.5 ${c.color} rounded-full animate-bounce [animation-delay:0.15s]`} />
          <span className={`w-1.5 h-1.5 ${c.color} rounded-full animate-bounce [animation-delay:0.3s]`} />
        </div>
      </div>
    </div>
  );
}

/* ───── 토론 갈래 트래커 ───── */

function BranchTracker({
  messages,
  expanded,
  onToggle,
  onBranchTap,
}: {
  messages: MessageType[];
  expanded: boolean;
  onToggle: () => void;
  onBranchTap: (branchId: string) => void;
}) {
  // 갈래별 카운트 계산
  const counts: Record<string, number> = {};
  for (const b of BRANCHES) counts[b.id] = 0;
  for (const msg of messages) {
    if (msg.branch && counts[msg.branch] !== undefined) {
      counts[msg.branch]++;
    }
  }

  return (
    <div className="px-4 py-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full"
      >
        {BRANCHES.map((b) => {
          const count = counts[b.id];
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
      </button>

      {expanded && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {BRANCHES.map((b) => {
            const count = counts[b.id];
            return (
              <button
                key={b.id}
                onClick={() => onBranchTap(b.id)}
                className={`text-left px-2.5 py-2 rounded-btn border transition-colors ${
                  count > 0
                    ? "border-ink-green/20 bg-ink-green/5 hover:bg-ink-green/10"
                    : "border-ink/[0.06] hover:border-ink-green/20 hover:bg-ink-green/5"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs">{b.icon}</span>
                  <span className="text-[10px] font-semibold text-ink">{b.label}</span>
                </div>
                {count > 0 && (
                  <span className="text-[9px] text-warmgray mt-0.5 block">{count}턴</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───── 메인 컴포넌트 ───── */

export default function DiscussPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const {
    messages,
    underlines,
    isStreaming,
    streamContent,
    setMessages,
    addMessage: addMsg,
    setUnderlines,
    addUnderline,
    setStreaming,
    setStreamContent,
    appendStreamContent,
  } = useDiscussionStore();

  const [book, setBook] = useState<Book | null>(null);
  const [input, setInput] = useState("");
  const [showUnderlineInput, setShowUnderlineInput] = useState(false);
  const [underlineText, setUnderlineText] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [lastFailedContent, setLastFailedContent] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookContextData, setBookContextData] = useState<any>(null);
  const [bookScraps, setBookScraps] = useState<{ text: string; memo?: string | null }[]>([]);
  const [otherReadingBooks, setOtherReadingBooks] = useState<{ title: string; author: string }[]>([]);

  // 갈래 트래커
  const [branchExpanded, setBranchExpanded] = useState(false);
  const [pendingBranchHint, setPendingBranchHint] = useState<string | null>(null);

  // 온보딩 웰컴 모드
  const isWelcome = searchParams.get("welcome") === "true";
  const welcomeReadingStatus = searchParams.get("readingStatus") || "reading";
  const [showGuide, setShowGuide] = useState(false);

  // 스트리밍 & 네트워크 상태
  const [streamPhase, setStreamPhase] = useState<StreamPhase>("idle");
  const streamPhaseRef = useRef<StreamPhase>("idle");
  const updateStreamPhase = useCallback((p: StreamPhase) => {
    streamPhaseRef.current = p;
    setStreamPhase(p);
  }, []);
  const [isOffline, setIsOffline] = useState(false);
  const [partialSavedContent, setPartialSavedContent] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const greetingSentRef = useRef(false);
  const greetingInProgressRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /* ───── 네트워크 상태 감지 ───── */

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      // 스트리밍 중이면 에러 상태로 전환
      if (isStreaming) {
        updateStreamPhase("error");
      }
    };
    const goOnline = () => {
      setIsOffline(false);
    };

    setIsOffline(!navigator.onLine);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [isStreaming]);

  /* ───── 부분 응답 저장 + 에러 처리 헬퍼 ───── */

  const savePartialResponse = useCallback(async (content: string, bookData: Book) => {
    if (!content.trim()) return;
    try {
      const supabase = createClient();
      const { cleanContent, branch } = parseBranchTag(content.trim());
      const assistantMsg = await addMessage(supabase, {
        book_id: bookData.id,
        role: "assistant",
        content: cleanContent,
        branch,
      });
      addMsg(assistantMsg);
      setPartialSavedContent(content.trim());
    } catch {
      // 오프라인이면 저장 실패 — 무시
    }
  }, [addMsg]);

  /* ───── SSE 스트림 읽기 공통 로직 ───── */

  const readStream = useCallback(async (
    res: Response,
    bookData: Book,
    onSearching?: (searching: boolean) => void,
  ): Promise<string> => {
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    if (!reader) throw new Error("No reader");

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.searching !== undefined) {
                onSearching?.(data.searching);
                continue;
              }
              if (data.text) {
                fullContent += data.text;
                appendStreamContent(data.text);
                if (streamPhaseRef.current !== "streaming") {
                  updateStreamPhase("streaming");
                }
              }
            } catch {
              // incomplete JSON
            }
          }
        }
      }
    } catch (err) {
      if (fullContent.trim()) {
        await savePartialResponse(fullContent, bookData);
      }
      throw err;
    }

    return fullContent;
  }, [appendStreamContent, savePartialResponse, updateStreamPhase]);

  /* ───── AI greeting / resume ───── */

  const sendAIGreeting = useCallback(
    async (
      bookData: Book,
      existingMessages: { role: string; content: string }[],
      ulTexts: { text: string }[],
      mode: "start" | "resume",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctxData?: any,
      scrapData?: { text: string; memo?: string | null }[],
    ) => {
      if (greetingInProgressRef.current) return;
      greetingInProgressRef.current = true;

      const supabase = createClient();
      setStreaming(true);
      setStreamContent("");
      updateStreamPhase("connecting");

      try {
        abortControllerRef.current = new AbortController();

        const res = await fetchWithAuth("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookInfo: `제목: ${bookData.title}, 저자: ${bookData.author || "미상"}`,
            messages: mode === "start" ? [] : existingMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            underlines: ulTexts,
            scraps: scrapData || [],
            topicMap: bookData.topic_map,
            greeting: mode,
            bookContextData: ctxData || null,
            readingStatus: welcomeReadingStatus,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        updateStreamPhase("thinking");

        const fullContent = await readStream(res, bookData, (searching) => {
          updateStreamPhase(searching ? "searching" : "thinking");
        });

        if (fullContent) {
          const { cleanContent, branch } = parseBranchTag(fullContent);
          const assistantMsg = await addMessage(supabase, {
            book_id: bookData.id,
            role: "assistant",
            content: cleanContent,
            branch,
          });
          addMsg(assistantMsg);
        } else {
          throw new Error("Empty response");
        }

        updateStreamPhase("idle");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          updateStreamPhase("idle");
        } else {
          console.error("Greeting error:", err);
          const fallbackContent =
            mode === "resume"
              ? `다시 만나서 반가워요!\n'${bookData.title}' 이야기를 이어서 나눠볼까요? 그 뒤로 더 읽으셨나요?`
              : `'${bookData.title}' 이야기를 나눠볼까요?\n읽으면서 가장 먼저 떠오르는 장면이나 느낌이 있나요?`;

          const supabase2 = createClient();
          try {
            const assistantMsg = await addMessage(supabase2, {
              book_id: bookData.id,
              role: "assistant",
              content: fallbackContent,
              branch: null,
            });
            addMsg(assistantMsg);
          } catch {
            updateStreamPhase("error");
          }
          if (streamPhaseRef.current !== "error") updateStreamPhase("idle");
        }
      }

      // addMsg → 렌더링 → streamContent 클리어 순서 보장
      setStreaming(false);
      // 짧은 딜레이로 메시지 렌더링 후 스트리밍 내용 클리어
      requestAnimationFrame(() => setStreamContent(""));
      greetingInProgressRef.current = false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addMsg, setStreaming, setStreamContent, readStream],
  );

  const prevBookIdRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  const userId = user?.id;
  useEffect(() => {
    if (!bookId || !userId) return;

    // bookId가 바뀔 때만 reset
    const isNewBook = prevBookIdRef.current !== bookId;
    if (isNewBook) {
      const { reset } = useDiscussionStore.getState();
      reset();
      setBook(null);
      greetingSentRef.current = false;
      greetingInProgressRef.current = false;
      updateStreamPhase("idle");
      prevBookIdRef.current = bookId;
      loadedRef.current = false;
    }

    // 이미 로드 완료된 상태면 재실행 안 함 (user 참조 변경 방지)
    if (loadedRef.current && !isNewBook) return;

    setLoadError(false);
    let cancelled = false;
    const supabase = createClient();
    const load = async () => {
      try {
        const [b, msgs, uls, scraps, allBooks] = await Promise.all([
          getBook(supabase, bookId),
          getMessages(supabase, bookId),
          getUnderlines(supabase, bookId),
          getScrapsByBook(supabase, bookId),
          getBooks(supabase, userId),
        ]);
        if (cancelled) return;
        loadedRef.current = true;
        if (b) setBook(b);
        setMessages(msgs);
        setUnderlines(uls);
        const scrapTexts = (scraps || [])
          .filter((s) => s.text?.trim())
          .map((s) => ({ text: s.text, memo: s.memo }));
        setBookScraps(scrapTexts);

        const others = allBooks
          .filter((ob) => ob.id !== bookId && ob.reading_status === "reading")
          .map((ob) => ({ title: ob.title, author: ob.author || "" }));
        setOtherReadingBooks(others);

        if (b && !greetingSentRef.current) {
          greetingSentRef.current = true;
          const isResume = searchParams.get("resume") === "1";
          const ulTexts = uls.map((u) => ({ text: u.text }));
          const needsGreeting = msgs.length === 0 || isResume;

          const ctxData = b.context_data || null;
          setBookContextData(ctxData);

          if (needsGreeting) {
            if (msgs.length === 0) {
              sendAIGreeting(b, [], ulTexts, "start", ctxData, scrapTexts);
            } else {
              sendAIGreeting(
                b,
                msgs.map((m) => ({ role: m.role, content: m.content })),
                ulTexts,
                "resume",
                ctxData,
                scrapTexts,
              );
            }
          }
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, userId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  /* ───── AbortController 정리 ───── */

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /* ───── 온보딩 가이드 툴팁 ───── */

  useEffect(() => {
    if (isWelcome && !localStorage.getItem("onboarding-guide-shown")) {
      setShowGuide(true);
    }
  }, [isWelcome]);

  /* ───── 메시지 전송 ───── */

  const sendMessage = async () => {
    if (!input.trim() || isStreaming || !book) return;
    if (isOffline) {
      toast.error("인터넷 연결을 확인해주세요");
      return;
    }

    const content = input.trim();
    setInput("");

    const supabase = createClient();
    const userMsg = await addMessage(supabase, {
      book_id: book.id,
      role: "user",
      content,
      branch: null,
    });
    addMsg(userMsg);

    // 스트릭 기록
    const uid = useAuthStore.getState().user?.id;
    if (uid) upsertStreak(supabase, uid, { discuss: true }).catch(() => {});

    setStreaming(true);
    setStreamContent("");
    setLastFailedContent(null);
    updateStreamPhase("connecting");
    setPartialSavedContent("");

    try {
      abortControllerRef.current = new AbortController();

      const res = await fetchWithAuth("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookInfo: `제목: ${book.title}, 저자: ${book.author || "미상"}`,
          messages: [...messages, { role: "user", content }].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          underlines: underlines.map((u) => ({ text: u.text })),
          scraps: bookScraps,
          topicMap: book.topic_map,
          bookContextData,
          branchHint: pendingBranchHint,
          otherReadingBooks,
        }),
        signal: abortControllerRef.current.signal,
      });

      // branchHint 사용 후 초기화
      setPendingBranchHint(null);

      if (res.status === 401) {
        toast.error("로그인이 필요해요. 다시 로그인해주세요.");
        setStreaming(false);
        updateStreamPhase("idle");
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || `서버 오류 (${res.status})`);
        setLastFailedContent(content);
        setStreaming(false);
        updateStreamPhase("error");
        return;
      }

      updateStreamPhase("thinking");

      const fullContent = await readStream(res, book, (searching) => {
        updateStreamPhase(searching ? "searching" : "thinking");
      });

      if (fullContent) {
        const { cleanContent, branch } = parseBranchTag(fullContent);
        const assistantMsg = await addMessage(supabase, {
          book_id: book.id,
          role: "assistant",
          content: cleanContent,
          branch,
        });
        addMsg(assistantMsg);
      }

      updateStreamPhase("idle");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        updateStreamPhase("idle");
      } else {
        console.error("Chat error:", err);
        updateStreamPhase("error");
        setLastFailedContent(content);
      }
    }

    setStreaming(false);
    requestAnimationFrame(() => setStreamContent(""));
  };

  const retryLastMessage = () => {
    if (isOffline) {
      toast.error("인터넷 연결을 확인해주세요");
      return;
    }
    if (lastFailedContent) {
      setInput(lastFailedContent);
      setLastFailedContent(null);
      updateStreamPhase("idle");
    }
  };

  const retryConnection = () => {
    if (isOffline) {
      toast.error("인터넷 연결을 확인해주세요");
      return;
    }
    updateStreamPhase("idle");
    if (lastFailedContent) {
      setInput(lastFailedContent);
      setLastFailedContent(null);
    }
  };

  const handleAddUnderline = async () => {
    if (!underlineText.trim() || !book) return;
    const supabase = createClient();
    try {
      const ul = await createUnderline(supabase, {
        book_id: book.id,
        scrap_id: null,
        text: underlineText.trim(),
        memo: null,
        chapter: null,
      });
      addUnderline(ul);
      setUnderlineText("");
      setShowUnderlineInput(false);
      toast.success("밑줄이 추가되었어요");
    } catch {
      toast.error("추가에 실패했어요");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <p className="text-warmgray text-sm mb-3">데이터를 불러오지 못했어요</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-ink-green font-semibold hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-screen text-warmgray text-sm">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-paper">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-warm border-b border-[var(--bd)]">
        <button onClick={() => router.push(`/book/${bookId}`)} className="text-ink-green">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{book.title}</p>
          <span className="text-[10px] text-warmgray truncate max-w-[120px] inline-block align-middle">{book.author}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setShowUnderlineInput(!showUnderlineInput)}
            className="w-10 h-10 rounded-btn flex items-center justify-center text-ink-green hover:bg-ink-green/5 active:bg-ink-green/10"
            title="밑줄 추가"
          >
            <PenLine className="w-4 h-4" />
          </button>
          <Link
            href={`/review/${book.id}`}
            className="w-10 h-10 rounded-btn flex items-center justify-center text-ink-green hover:bg-ink-green/5 active:bg-ink-green/10"
            title="서평 쓰기"
          >
            <BookOpenCheck className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Branch Tracker */}
      <BranchTracker
        messages={messages}
        expanded={branchExpanded}
        onToggle={() => setBranchExpanded(!branchExpanded)}
        onBranchTap={(branchId) => {
          const branch = BRANCHES.find((b) => b.id === branchId);
          if (branch) {
            setPendingBranchHint(branchId);
            setBranchExpanded(false);
            setInput(`${branch.label}에 대해 이야기해볼까요?`);
          }
        }}
      />

      {/* Underline Input */}
      {showUnderlineInput && (
        <div className="px-4 py-2 bg-warm border-b border-[var(--bd)]">
          <div className="flex gap-2">
            <input
              value={underlineText}
              onChange={(e) => setUnderlineText(e.target.value)}
              placeholder="밑줄 친 문장을 입력하세요"
              maxLength={500}
              className="flex-1 text-sm bg-paper border border-[var(--bd2)] rounded-btn px-3 py-1.5"
            />
            <button
              onClick={handleAddUnderline}
              disabled={!underlineText.trim()}
              className="px-3 py-1.5 bg-ink-green text-paper text-xs rounded-btn font-semibold disabled:opacity-50"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* Connection / Offline Banner */}
      <ConnectionBanner
        phase={streamPhase}
        isOffline={isOffline}
        onRetry={retryConnection}
        partialContent={partialSavedContent}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isWelcome && messages.length <= 1 && (
          <div style={{ textAlign: "center", marginBottom: 16, animation: "fadeIn 0.3s ease-out" }}>
            <span style={{
              display: "inline-block", fontSize: 9, fontWeight: 800,
              color: "var(--ac)", letterSpacing: 2, textTransform: "uppercase",
              padding: "4px 12px", border: "1px solid var(--bd2)",
              borderRadius: 100, transition: "all 0.4s",
            }}>
              첫 번째 대화
            </span>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex contain-layout ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-card ${
                msg.role === "user"
                  ? "bg-ink-green text-paper"
                  : "bg-warm border border-[var(--bd)]"
              }`}
            >
              {msg.role === "assistant" && (
                <span className="text-[10px] text-ink-muted font-semibold block mb-1">
                  방긋
                </span>
              )}
              <p className="text-sm leading-chat whitespace-pre-wrap">
                {msg.content}
              </p>
            </div>
          </div>
        ))}

        {/* 스트리밍 중 텍스트 표시 (branch 태그 숨김) */}
        {isStreaming && streamContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-4 py-3 rounded-card bg-warm border border-[var(--bd)]">
              <span className="text-[10px] text-ink-muted font-semibold block mb-1">
                방긋
              </span>
              <p className="text-sm leading-chat whitespace-pre-wrap">
                {streamContent.replace(/\s*\[branch:\s*[\w]+\]\s*$/, "")}
                <span className="inline-block w-1.5 h-4 bg-ink-green/40 animate-pulse ml-0.5" />
              </p>
            </div>
          </div>
        )}

        {/* 스트리밍 상태 인디케이터 (텍스트 아직 안 왔을 때) */}
        {isStreaming && !streamContent && (
          <StreamIndicator phase={streamPhase} />
        )}

        {/* 실패 시 재시도 버튼 */}
        {lastFailedContent && !isStreaming && streamPhase !== "error" && (
          <div className="flex justify-center py-2">
            <button
              onClick={retryLastMessage}
              className="text-xs text-terra bg-terra/10 px-3 py-1.5 rounded-btn font-semibold hover:bg-terra/20 transition-colors"
            >
              응답 실패 — 다시 시도
            </button>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Guide Tooltip */}
      {showGuide && (
        <div style={{
          background: "color-mix(in srgb, var(--ac) 6%, transparent)",
          border: "1px solid color-mix(in srgb, var(--ac) 15%, transparent)",
          borderRadius: 12, padding: "12px 14px", margin: "0 16px 12px",
          animation: "fadeIn 0.3s ease-out", transition: "all 0.4s",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--ac)" }}>
              <Lightbulb size={12} />
              이렇게 대화해보세요
            </div>
            <button onClick={() => {
              setShowGuide(false);
              localStorage.setItem("onboarding-guide-shown", "1");
            }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
              <X size={12} style={{ color: "var(--tm)" }} />
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--ts)", lineHeight: 1.7 }}>
            인상 깊었던 장면이나 느낌을 자유롭게 이야기해주세요.
            정답은 없어요 — 솔직한 감상이 최고의 대화예요.
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-warm border-t border-[var(--bd)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isOffline ? "인터넷 연결을 확인해주세요..." : "이야기를 나눠보세요..."}
            rows={1}
            maxLength={2000}
            disabled={isOffline}
            className="flex-1 bg-paper border-[var(--bd2)] rounded-btn resize-none leading-body min-h-[40px] max-h-[120px] disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming || isOffline}
            className="w-11 h-11 bg-ink-green text-paper rounded-btn flex items-center justify-center hover:bg-ink-medium active:bg-ink-dark transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
