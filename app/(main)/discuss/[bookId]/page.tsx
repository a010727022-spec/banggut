"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useDiscussionStore } from "@/stores/useDiscussionStore";
import {
  getBook,
  getMessages,
  getUnderlines,
  addMessage,
  createUnderline,
  updateBook,
} from "@/lib/supabase/queries";
import { PHASES, getPhaseByMessageCount, getPhaseIndex } from "@/lib/types";
import type { Book } from "@/lib/types";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Send,
  PenLine,
  BookOpenCheck,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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
  const [isSearching, setIsSearching] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookContextData, setBookContextData] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const greetingSentRef = useRef(false);

  // --- AI greeting / resume ---
  const sendAIGreeting = useCallback(
    async (
      bookData: Book,
      existingMessages: { role: string; content: string }[],
      ulTexts: { text: string }[],
      mode: "start" | "resume",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctxData?: any,
    ) => {
      const supabase = createClient();
      setStreaming(true);
      setStreamContent("");

      try {
        const currentPhase = getPhaseByMessageCount(
          mode === "start" ? 0 : existingMessages.length,
        );

        const res = await fetchWithAuth("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookInfo: `제목: ${bookData.title}, 저자: ${bookData.author || "미상"}`,
            messages: mode === "start" ? [] : existingMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            phase: currentPhase.label,
            underlines: ulTexts,
            topicMap: bookData.topic_map,
            greeting: mode,
            bookContextData: ctxData || null,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";
        let buffer = "";

        if (reader) {
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
                  if (data.searching !== undefined) continue;
                  if (data.text) {
                    fullContent += data.text;
                    appendStreamContent(data.text);
                  }
                } catch {
                  // incomplete JSON
                }
              }
            }
          }
        }

        if (fullContent) {
          const assistantMsg = await addMessage(supabase, {
            book_id: bookData.id,
            role: "assistant",
            content: fullContent,
          });
          addMsg(assistantMsg);
        } else {
          throw new Error("Empty response");
        }
      } catch (err) {
        console.error("Greeting error:", err);
        // 폴백 메시지
        const fallbackContent =
          mode === "resume"
            ? `다시 만나서 반가워요! 📖\n'${bookData.title}' 이야기를 이어서 나눠볼까요? 그 뒤로 더 읽으셨나요?`
            : `'${bookData.title}' 이야기를 나눠볼까요? 📖\n읽으면서 가장 먼저 떠오르는 장면이나 느낌이 있나요?`;

        const supabase = createClient();
        const assistantMsg = await addMessage(supabase, {
          book_id: bookData.id,
          role: "assistant",
          content: fallbackContent,
        });
        addMsg(assistantMsg);
      }

      setStreaming(false);
      setStreamContent("");
    },
    [addMsg, appendStreamContent, setStreaming, setStreamContent],
  );

  useEffect(() => {
    // 다른 책으로 이동 시 이전 상태 초기화
    const { reset } = useDiscussionStore.getState();
    reset();
    setBook(null);
    greetingSentRef.current = false;

    if (!bookId || !user) return;
    setLoadError(false);
    const supabase = createClient();
    const load = async () => {
      try {
        const [b, msgs, uls] = await Promise.all([
          getBook(supabase, bookId),
          getMessages(supabase, bookId),
          getUnderlines(supabase, bookId),
        ]);
        if (b) setBook(b);
        setMessages(msgs);
        setUnderlines(uls);

        // AI 자동 인사
        if (b && !greetingSentRef.current) {
          greetingSentRef.current = true;
          const isResume = searchParams.get("resume") === "1";
          const ulTexts = uls.map((u) => ({ text: u.text }));
          const needsGreeting = msgs.length === 0 || isResume;

          if (needsGreeting) {
            // 책 정보를 백그라운드로 가져와서 인사에 활용
            let ctxData = b.context_data || null;
            if (!ctxData) {
              try {
                const ctxRes = await fetchWithAuth("/api/book-context", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: b.title, author: b.author, bookId: b.id }),
                });
                const ctxJson = await ctxRes.json();
                ctxData = ctxJson.context;
              } catch {
                // context 없어도 인사는 가능
              }
            }
            setBookContextData(ctxData);

            if (msgs.length === 0) {
              sendAIGreeting(b, [], ulTexts, "start", ctxData);
            } else {
              sendAIGreeting(
                b,
                msgs.map((m) => ({ role: m.role, content: m.content })),
                ulTexts,
                "resume",
                ctxData,
              );
            }
          } else {
            // 기존 대화 보기만 — 캐시 있으면 사용, 없으면 백그라운드로 가져옴
            if (b.context_data) {
              setBookContextData(b.context_data);
            } else {
              fetchWithAuth("/api/book-context", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: b.title, author: b.author, bookId: b.id }),
              })
                .then((r) => r.json())
                .then((d) => setBookContextData(d.context))
                .catch(() => {});
            }
          }
        }
      } catch {
        setLoadError(true);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  // 모바일 키보드 올라올 때 자동 스크롤
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  const currentPhase = getPhaseByMessageCount(messages.length);
  const phaseIndex = getPhaseIndex(messages.length);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming || !book) return;
    const content = input.trim();
    setInput("");

    const supabase = createClient();
    const userMsg = await addMessage(supabase, {
      book_id: book.id,
      role: "user",
      content,
    });
    addMsg(userMsg);

    setStreaming(true);
    setStreamContent("");
    setLastFailedContent(null);
    setIsSearching(false);

    try {
      const res = await fetchWithAuth("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookInfo: `제목: ${book.title}, 저자: ${book.author || "미상"}`,
          messages: [...messages, { role: "user", content }].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          phase: currentPhase.label,
          underlines: underlines.map((u) => ({ text: u.text })),
          topicMap: book.topic_map,
          bookContextData,
        }),
      });

      if (res.status === 401) {
        toast.error("로그인이 필요해요. 다시 로그인해주세요.");
        setStreaming(false);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || `서버 오류 (${res.status})`);
        setLastFailedContent(content);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // 마지막 줄은 아직 완성되지 않았을 수 있으므로 버퍼에 보관
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
              try {
                const data = JSON.parse(trimmed.slice(6));
                // 실시간 검색 상태 처리
                if (data.searching === true) {
                  setIsSearching(true);
                  continue;
                }
                if (data.searching === false) {
                  setIsSearching(false);
                  continue;
                }
                if (data.text) {
                  fullContent += data.text;
                  appendStreamContent(data.text);
                }
              } catch {
                // 불완전한 JSON — 다음 청크에서 처리
              }
            }
          }
        }
      }

      if (fullContent) {
        const assistantMsg = await addMessage(supabase, {
          book_id: book.id,
          role: "assistant",
          content: fullContent,
        });
        addMsg(assistantMsg);

        // Update phase
        const newPhaseIndex = getPhaseIndex(messages.length + 2);
        if (newPhaseIndex !== phaseIndex) {
          await updateBook(supabase, book.id, { phase: newPhaseIndex });
          setBook({ ...book, phase: newPhaseIndex });
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      toast.error("응답을 받지 못했어요. 다시 시도해주세요.");
      setLastFailedContent(content);
    }

    setStreaming(false);
    setStreamContent("");
  };

  const retryLastMessage = () => {
    if (!lastFailedContent) return;
    setInput(lastFailedContent);
    setLastFailedContent(null);
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
      <header className="flex items-center gap-3 px-4 py-3 bg-warm border-b border-[rgba(43,76,63,0.08)]">
        <button onClick={() => router.push(`/book/${bookId}`)} className="text-ink-green">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{book.title}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-warmgray truncate max-w-[120px] inline-block align-middle">{book.author}</span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-badge font-semibold text-paper"
              style={{ backgroundColor: currentPhase.color }}
            >
              {currentPhase.icon} {currentPhase.label}
            </span>
          </div>
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

      {/* Phase Progress */}
      <div className="flex px-4 py-2 gap-1">
        {PHASES.map((p, i) => (
          <div
            key={p.id}
            className="flex-1 h-1 rounded-full transition-colors"
            style={{
              backgroundColor: i <= phaseIndex ? p.color : "rgba(43,76,63,0.08)",
            }}
          />
        ))}
      </div>

      {/* Underline Input */}
      {showUnderlineInput && (
        <div className="px-4 py-2 bg-warm border-b border-[rgba(43,76,63,0.08)]">
          <div className="flex gap-2">
            <input
              value={underlineText}
              onChange={(e) => setUnderlineText(e.target.value)}
              placeholder="밑줄 친 문장을 입력하세요"
              maxLength={500}
              className="flex-1 text-sm bg-paper border border-[rgba(43,76,63,0.15)] rounded-btn px-3 py-1.5"
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex contain-layout ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-card ${
                msg.role === "user"
                  ? "bg-ink-green text-paper"
                  : "bg-warm border border-[rgba(43,76,63,0.08)]"
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

        {isStreaming && streamContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-4 py-3 rounded-card bg-warm border border-[rgba(43,76,63,0.08)]">
              <span className="text-[10px] text-ink-muted font-semibold block mb-1">
                방긋
              </span>
              <p className="text-sm leading-chat whitespace-pre-wrap">
                {streamContent}
                <span className="inline-block w-1.5 h-4 bg-ink-green/40 animate-pulse ml-0.5" />
              </p>
            </div>
          </div>
        )}

        {isStreaming && !streamContent && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-card bg-warm border border-[rgba(43,76,63,0.08)]">
              <span className="text-[10px] text-ink-muted font-semibold block mb-1">
                방긋
              </span>
              {isSearching ? (
                <>
                  <p className="text-xs text-warmgray mb-2">잠깐, 정리해볼게요... 📚</p>
                  <div className="flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-gold/60 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-gold/60 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 bg-gold/60 rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-warmgray mb-2">생각하는 중...</p>
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-ink-green/40 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-ink-green/40 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 bg-ink-green/40 rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {lastFailedContent && !isStreaming && (
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

      {/* Input */}
      <div className="px-4 py-3 bg-warm border-t border-[rgba(43,76,63,0.08)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="이야기를 나눠보세요..."
            rows={1}
            maxLength={2000}
            className="flex-1 bg-paper border-[rgba(43,76,63,0.15)] rounded-btn resize-none leading-body min-h-[40px] max-h-[120px]"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="w-11 h-11 bg-ink-green text-paper rounded-btn flex items-center justify-center hover:bg-ink-medium active:bg-ink-dark transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
