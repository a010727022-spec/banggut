"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { createBook, getBooks } from "@/lib/supabase/queries";
import { getAvatarSrc } from "@/lib/types";
import { BookOpen, Bookmark, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface InvitePreview {
  book: {
    id: string;
    title: string;
    author: string | null;
    cover_url: string | null;
    genre: string | null;
    reading_status: string;
    progress_percent: number | null;
    rating: number | null;
    total_pages: number | null;
  };
  inviter: { nickname: string; emoji: string } | null;
}

export default function InvitePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const bookId = params.bookId as string;
  const fromUserId = searchParams.get("from") || "";

  const [data, setData] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [alreadyInLibrary, setAlreadyInLibrary] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams({ bookId });
    if (fromUserId) qs.set("from", fromUserId);
    fetch(`/api/invite-preview?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [bookId, fromUserId]);

  // 이미 내 서재에 있는 책인지 확인 (로그인 시에만)
  useEffect(() => {
    if (!user || !data?.book) return;
    const sb = createClient();
    getBooks(sb, user.id)
      .then((books) => {
        const dup = books.find(
          (b) =>
            b.title === data.book.title &&
            (b.author || "") === (data.book.author || "")
        );
        setAlreadyInLibrary(!!dup);
      })
      .catch(() => {});
  }, [user, data]);

  async function handleAccept(status: "want_to_read" | "reading") {
    if (!user) {
      // 로그인 페이지로. 돌아올 URL 저장
      const returnUrl = `/invite/${bookId}${fromUserId ? `?from=${fromUserId}` : ""}`;
      router.push(`/onboarding?returnTo=${encodeURIComponent(returnUrl)}`);
      return;
    }
    if (!data?.book) return;
    if (alreadyInLibrary) {
      toast.info("이미 서재에 있는 책이에요");
      router.push("/");
      return;
    }
    setAccepting(true);
    try {
      const sb = createClient();
      const nowIso = new Date().toISOString();
      const statusFields: Record<string, unknown> = { reading_status: status };
      if (status === "reading") statusFields.started_at = nowIso;

      await createBook(sb, {
        user_id: user.id,
        title: data.book.title,
        author: data.book.author,
        genre: data.book.genre,
        cover_url: data.book.cover_url,
        total_pages: data.book.total_pages,
        ...statusFields,
      });

      toast.success(
        status === "reading"
          ? `${data.inviter?.nickname ?? "친구"}님과 같이 읽기 시작해요`
          : "위시리스트에 담았어요"
      );
      router.push(status === "reading" ? "/" : "/?tab=wish");
    } catch {
      toast.error("책 담기에 실패했어요");
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--tm)", fontSize: 13 }}>불러오는 중</p>
      </div>
    );
  }

  if (!data?.book) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <img src="/logo-banggut.svg" alt="" width={80} height={80} style={{ opacity: 0.6 }} />
        <p style={{ color: "var(--tp)", fontSize: 15, fontWeight: 500 }}>초대를 찾을 수 없어요</p>
        <button onClick={() => router.push("/")} style={{ padding: "12px 24px", borderRadius: 100, background: "var(--ac)", color: "var(--acc)", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
          방긋 홈으로
        </button>
      </div>
    );
  }

  const { book, inviter } = data;
  const inviterAvatar = inviter ? getAvatarSrc(inviter.emoji) : null;
  const statusLabel =
    book.reading_status === "want_to_read"
      ? "위시리스트에 담았어요"
      : book.reading_status === "finished"
      ? "완독했어요"
      : book.reading_status === "reading" && book.progress_percent
      ? `${book.progress_percent}% 읽는 중`
      : "읽는 중";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 40 }}>
      {/* 글로우 배경 */}
      <div style={{
        position: "absolute",
        top: -40,
        left: "50%",
        transform: "translateX(-50%)",
        width: 340,
        height: 340,
        borderRadius: "50%",
        background: "radial-gradient(circle, color-mix(in srgb, var(--ac) 18%, transparent) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* 상단 */}
      <div style={{ position: "relative", zIndex: 2, padding: "16px 18px" }}>
        <button
          onClick={() => router.push("/")}
          style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--sf)", border: "0.5px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}
        >
          <ArrowLeft size={16} color="var(--ts)" strokeWidth={2} />
        </button>
      </div>

      {/* 방긋이 + 초대 메시지 */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "8px 24px 28px" }}>
        <img src="/logo-banggut.svg" alt="" width={68} height={68} style={{ margin: "0 auto 14px" }} />
        {inviter && inviterAvatar ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--sf)", border: "0.5px solid var(--bd)", padding: "6px 14px 6px 6px", borderRadius: 100, marginBottom: 12 }}>
            <img src={inviterAvatar} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
            <span style={{ fontSize: 12, color: "var(--tp)", fontWeight: 600 }}>{inviter.nickname}님이 초대했어요</span>
          </div>
        ) : inviter ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--sf)", border: "0.5px solid var(--bd)", padding: "6px 14px", borderRadius: 100, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>{inviter.emoji}</span>
            <span style={{ fontSize: 12, color: "var(--tp)", fontWeight: 600 }}>{inviter.nickname}님이 초대했어요</span>
          </div>
        ) : null}
        <h1 style={{ fontFamily: "'Gaegu', cursive", fontSize: 26, fontWeight: 700, color: "var(--tp)", letterSpacing: "0.02em", lineHeight: 1.4 }}>
          같이 읽어볼래요?
        </h1>
      </div>

      {/* 책 정보 */}
      <div style={{ position: "relative", zIndex: 2, padding: "0 24px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 140, height: 204, borderRadius: 10, overflow: "hidden", boxShadow: "0 16px 40px color-mix(in srgb, var(--ac) 18%, rgba(0,0,0,0.12))", border: "0.5px solid var(--bd)", marginBottom: 20 }}>
          {book.cover_url ? (
            <img src={book.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "var(--sf2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={28} color="var(--tm)" />
            </div>
          )}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--tp)", textAlign: "center", lineHeight: 1.3, letterSpacing: "-0.3px", marginBottom: 4 }}>
          {book.title}
        </h2>
        {book.author && <p style={{ fontSize: 13, color: "var(--tm)", marginBottom: 14 }}>{book.author}</p>}
        {inviter && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 100, background: "color-mix(in srgb, var(--ac) 10%, var(--bg))", border: "0.5px solid color-mix(in srgb, var(--ac) 30%, transparent)" }}>
            <Bookmark size={11} color="var(--ac)" strokeWidth={2.5} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ac)" }}>{inviter.nickname}님이 {statusLabel}</span>
          </div>
        )}
      </div>

      {/* CTA 영역 */}
      <div style={{ position: "relative", zIndex: 2, padding: "0 20px" }}>
        {alreadyInLibrary ? (
          <div style={{ padding: "16px", borderRadius: 16, background: "var(--sf)", border: "0.5px solid var(--bd)", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--tp)", fontWeight: 600, marginBottom: 10 }}>이미 서재에 있는 책이에요</p>
            <button
              onClick={() => router.push(`/book/${book.id}`)}
              style={{ padding: "10px 20px", borderRadius: 100, background: "var(--ac)", color: "var(--acc)", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              내 책 열어보기
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => handleAccept("reading")}
              disabled={accepting}
              style={{
                padding: "16px 18px",
                borderRadius: 20,
                background: "linear-gradient(135deg, var(--ac), var(--ac2))",
                color: "var(--acc)",
                fontFamily: "'Gaegu', cursive",
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "0.04em",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 18px color-mix(in srgb, var(--ac) 30%, transparent)",
                opacity: accepting ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              📖 나도 읽기 시작
            </button>
            <button
              onClick={() => handleAccept("want_to_read")}
              disabled={accepting}
              style={{
                padding: "14px 18px",
                borderRadius: 20,
                background: "var(--sf)",
                color: "var(--tp)",
                fontSize: 14,
                fontWeight: 700,
                border: "0.5px solid var(--bd2)",
                cursor: "pointer",
                opacity: accepting ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              🌙 일단 위시에 담기
            </button>
            {!user && (
              <p style={{ fontSize: 11, color: "var(--tm)", textAlign: "center", marginTop: 6, lineHeight: 1.6 }}>
                방긋 시작 후 자동으로 이 화면으로 돌아와요
              </p>
            )}
          </div>
        )}
      </div>

      {/* 하단 앱 소개 */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "32px 24px 20px", color: "var(--tm)", fontSize: 11, lineHeight: 1.7 }}>
        <p style={{ fontFamily: "'Gaegu', cursive", fontSize: 14, fontWeight: 700, color: "var(--ac)", marginBottom: 4 }}>방긋</p>
        <p>혼자 읽어도 외롭지 않게</p>
      </div>
    </div>
  );
}
