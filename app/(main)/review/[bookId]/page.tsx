"use client";

import { useEffect, useState } from "react";
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
} from "@/lib/supabase/queries";
import type { Book, Message, Diagnosis } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Sparkles, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

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
        }
      } catch {
        setLoadError(true);
      }
    };
    load();
  }, [bookId, user]);

  const generateDraft = async () => {
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
      if (mode === "essay") {
        setEssayBody(data.content.body);
      } else {
        setOneliner(data.content.oneliner || "");
        setKeywords((data.content.keywords || []).join(", "));
        setTarget(data.content.target || "");
        setStructuredBody(data.content.body || "");
      }
      toast.success("초안이 생성되었어요");
    } catch {
      toast.error("생성에 실패했어요");
    }
    setGenerating(false);
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
      toast.success("서평이 저장되었어요");
      router.push("/");
    } catch {
      toast.error("저장에 실패했어요");
    }
    setSaving(false);
  };

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
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-ink-green">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black text-ink-green">✍️ 서평 쓰기</h1>
          <p className="text-xs text-warmgray">{book.title}</p>
        </div>
      </div>

      {/* Diagnosis */}
      <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink-green">🔍 AI 독서 진단</h3>
          <Button
            onClick={runDiagnosis}
            disabled={diagnosing}
            variant="outline"
            size="sm"
            className="text-xs border-ink-green text-ink-green hover:bg-ink-green/5 rounded-btn"
          >
            {diagnosing ? "분석 중..." : "진단하기"}
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

      {/* Review Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "essay" | "structured")}>
        <TabsList className="w-full bg-ink-green/5 rounded-btn mb-4">
          <TabsTrigger value="essay" className="flex-1 text-sm rounded-btn data-[state=active]:bg-ink-green data-[state=active]:text-paper">
            📝 에세이형
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
            className="bg-warm border-[rgba(43,76,63,0.15)] rounded-btn resize-none leading-body"
          />
        </TabsContent>

        <TabsContent value="structured" className="space-y-3">
          <Input
            value={oneliner}
            onChange={(e) => setOneliner(e.target.value)}
            placeholder="한줄평"
            maxLength={100}
            className="bg-warm border-[rgba(43,76,63,0.15)] rounded-btn"
          />
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="키워드 (쉼표 구분)"
            maxLength={100}
            className="bg-warm border-[rgba(43,76,63,0.15)] rounded-btn"
          />
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="추천 대상"
            maxLength={100}
            className="bg-warm border-[rgba(43,76,63,0.15)] rounded-btn"
          />
          <Textarea
            value={structuredBody}
            onChange={(e) => setStructuredBody(e.target.value)}
            placeholder="본문 서평"
            rows={8}
            maxLength={3000}
            className="bg-warm border-[rgba(43,76,63,0.15)] rounded-btn resize-none leading-body"
          />
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="mt-4 space-y-3">
        <Button
          onClick={generateDraft}
          disabled={generating}
          variant="outline"
          className="w-full border-ink-green text-ink-green hover:bg-ink-green/5 rounded-btn h-10"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {generating ? "생성 중..." : "AI 초안 생성"}
        </Button>

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

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-ink-green text-paper hover:bg-ink-medium rounded-btn h-12 text-base font-semibold"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "저장 중..." : "서평 저장"}
        </Button>
      </div>
    </div>
  );
}
