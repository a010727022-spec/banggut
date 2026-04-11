"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import type { ReadingGroup } from "@/lib/types";
import { Users, BookOpen, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [group, setGroup] = useState<ReadingGroup | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [currentBookTitle, setCurrentBookTitle] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "not_found" | "found" | "joining" | "already" | "done" | "no_code">("loading");

  useEffect(() => {
    if (!code) { setStatus("no_code"); return; }
    if (isLoading) return; // auth 로딩 중이면 대기

    const load = async () => {
      const supabase = createClient();

      // 모임 찾기
      const { data: g } = await supabase
        .from("reading_groups")
        .select("*")
        .eq("invite_code", code.toUpperCase())
        .maybeSingle();

      if (!g) { setStatus("not_found"); return; }
      setGroup(g);

      // 멤버 수
      const { count } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", g.id);
      setMemberCount(count || 0);

      // 현재 읽는 책
      const { data: cb } = await supabase
        .from("group_books")
        .select("book_title")
        .eq("group_id", g.id)
        .eq("status", "reading")
        .maybeSingle();
      if (cb) setCurrentBookTitle(cb.book_title);

      // 로그인 안 돼있으면 로그인 페이지로
      if (!user) {
        setStatus("found");
        return;
      }

      // 이미 멤버인지 체크
      const { data: existing } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("group_id", g.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        setStatus("already");
        // 이미 멤버면 바로 이동
        setTimeout(() => router.push(`/groups/${g.id}`), 1500);
        return;
      }

      setStatus("found");
    };

    load();
  }, [code, user, isLoading, router]);

  const handleJoin = async () => {
    if (!group || !user) {
      // 로그인 안 돼있으면 로그인 페이지로 (돌아올 URL 포함)
      router.push(`/onboarding?redirect=/groups/join?code=${code}`);
      return;
    }

    setStatus("joining");
    try {
      const supabase = createClient();

      // 멤버 추가
      await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: user.id,
        role: "member",
      });

      // 현재 읽는 책 서재에 자동 추가
      const { data: currentBook } = await supabase
        .from("group_books")
        .select("*")
        .eq("group_id", group.id)
        .eq("status", "reading")
        .maybeSingle();

      if (currentBook) {
        // 이미 서재에 있는지 확인
        const { data: existingBook } = await supabase
          .from("books")
          .select("id")
          .eq("user_id", user.id)
          .eq("group_book_id", currentBook.id)
          .maybeSingle();

        if (!existingBook) {
          await supabase.from("books").insert({
            user_id: user.id,
            title: currentBook.book_title,
            author: currentBook.book_author,
            cover_url: currentBook.book_cover_url,
            total_pages: currentBook.total_pages,
            current_page: 0,
            reading_status: "reading",
            started_at: new Date().toISOString(),
            group_book_id: currentBook.id,
          });
        }
      }

      setStatus("done");
      toast.success("참여 완료!");
      setTimeout(() => router.push(`/groups/${group.id}`), 1200);
    } catch (err) {
      console.error("Join error:", err);
      toast.error("참여에 실패했어요");
      setStatus("found");
    }
  };

  // 로딩
  if (status === "loading" || isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
        <Loader2 size={24} color="var(--ac)" strokeWidth={1.5} className="animate-spin" />
        <p style={{ fontSize: 13, color: "var(--ts)" }}>모임 정보를 불러오는 중...</p>
      </div>
    );
  }

  // 코드 없음
  if (status === "no_code") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(232,144,126,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Users size={24} color="#E8907E" strokeWidth={1.5} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--tp)", marginBottom: 8 }}>초대 코드가 없어요</p>
        <p style={{ fontSize: 13, color: "var(--ts)", marginBottom: 24 }}>올바른 초대 링크로 다시 접속해주세요</p>
        <button onClick={() => router.push("/groups")} className="btn-main" style={{ maxWidth: 240 }}>
          모임 탭으로 이동
        </button>
      </div>
    );
  }

  // 모임 못 찾음
  if (status === "not_found") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(232,144,126,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Users size={24} color="#E8907E" strokeWidth={1.5} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--tp)", marginBottom: 8 }}>존재하지 않는 모임이에요</p>
        <p style={{ fontSize: 13, color: "var(--ts)", marginBottom: 8 }}>초대 코드: {code}</p>
        <p style={{ fontSize: 12, color: "var(--tm)", marginBottom: 24 }}>코드를 다시 확인해주세요</p>
        <button onClick={() => router.push("/groups")} className="btn-main" style={{ maxWidth: 240 }}>
          모임 탭으로 이동
        </button>
      </div>
    );
  }

  // 이미 멤버
  if (status === "already") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "color-mix(in srgb, var(--ac) 8%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Check size={24} color="var(--ac)" strokeWidth={1.5} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--tp)", marginBottom: 8 }}>이미 참여한 모임이에요</p>
        <p style={{ fontSize: 13, color: "var(--ts)" }}>모임 페이지로 이동할게요...</p>
      </div>
    );
  }

  // 참여 완료
  if (status === "done") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "color-mix(in srgb, var(--ac) 8%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Check size={24} color="var(--ac)" strokeWidth={1.5} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--tp)", marginBottom: 8 }}>참여 완료!</p>
        <p style={{ fontSize: 13, color: "var(--ts)" }}>모임 페이지로 이동할게요...</p>
      </div>
    );
  }

  // 모임 찾음 → 참여 화면
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: "0 24px" }}>
      {/* 모임 카드 */}
      <div style={{
        width: "100%", maxWidth: 320, borderRadius: 20, overflow: "hidden",
        background: "#fff", boxShadow: "0 4px 24px var(--bd)",
        border: "0.5px solid var(--bd)",
      }}>
        {/* 다크 헤더 */}
        <div style={{
          padding: "24px 20px 20px",
          background: "linear-gradient(145deg, #3D6B5A, var(--ac))",
          color: "#fff", textAlign: "center",
        }}>
          <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>독서 모임 초대</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>{group?.name}</h2>
          {group?.description && (
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>{group.description}</p>
          )}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 14 }}>
            <span style={{ fontSize: 11, opacity: 0.5 }}>
              <Users size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
              {memberCount}명
            </span>
            {currentBookTitle && (
              <span style={{ fontSize: 11, opacity: 0.5 }}>
                <BookOpen size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                {currentBookTitle}
              </span>
            )}
          </div>
        </div>

        {/* 참여 버튼 */}
        <div style={{ padding: "20px" }}>
          <button
            onClick={handleJoin}
            disabled={status === "joining"}
            className="btn-main"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: status === "joining" ? 0.6 : 1,
            }}
          >
            {status === "joining" ? (
              <><Loader2 size={16} className="animate-spin" /> 참여 중...</>
            ) : user ? (
              "이 모임에 참여하기"
            ) : (
              "로그인하고 참여하기"
            )}
          </button>
          {!user && (
            <p style={{ fontSize: 11, color: "var(--tm)", textAlign: "center", marginTop: 8 }}>로그인 후 자동으로 참여됩니다</p>
          )}
        </div>
      </div>

      {/* 코드 표시 */}
      <p style={{ fontSize: 11, color: "var(--tm)", marginTop: 24 }}>초대 코드: {code}</p>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Suspense fallback={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <Loader2 size={24} color="var(--ac)" strokeWidth={1.5} className="animate-spin" />
        </div>
      }>
        <JoinContent />
      </Suspense>
    </div>
  );
}
