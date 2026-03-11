"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { getBooks, getReviewsByUser, getTotalMessageCount } from "@/lib/supabase/queries";
import { useRouter } from "next/navigation";
import type { Review } from "@/lib/types";
import { LogOut, BookOpen, PenLine, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { books, setBooks } = useLibraryStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      getBooks(supabase, user.id).then(setBooks),
      getReviewsByUser(supabase, user.id).then(setReviews),
      getTotalMessageCount(supabase, user.id).then(setTotalMessages),
    ])
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [user, setBooks]);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
      router.push("/onboarding");
    } catch {
      toast.error("로그아웃에 실패했어요");
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-warmgray text-sm">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      {/* Profile Card */}
      <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-6 mb-6 text-center">
        <div className="text-5xl mb-3">{user?.emoji || "🦊"}</div>
        <h1 className="text-xl font-black text-ink-green truncate max-w-[240px] mx-auto">{user?.nickname || "독서가"}</h1>
        <p className="text-xs text-warmgray mt-1">
          {new Date(user?.created_at || "").toLocaleDateString("ko")} 가입
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-3 text-center">
          <BookOpen className="w-5 h-5 text-ink-green mx-auto mb-1" />
          <p className="text-lg font-black text-ink-green">{books.length}</p>
          <p className="text-[10px] text-warmgray">읽은 책</p>
        </div>
        <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-3 text-center">
          <PenLine className="w-5 h-5 text-ink-green mx-auto mb-1" />
          <p className="text-lg font-black text-ink-green">{reviews.length}</p>
          <p className="text-[10px] text-warmgray">서평</p>
        </div>
        <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-3 text-center">
          <MessageCircle className="w-5 h-5 text-ink-green mx-auto mb-1" />
          <p className="text-lg font-black text-ink-green">{totalMessages}</p>
          <p className="text-[10px] text-warmgray">토론</p>
        </div>
      </div>

      {/* Reviews */}
      <h2 className="text-sm font-semibold text-ink-green mb-3">내 서평</h2>
      {reviews.length === 0 ? (
        <div className="text-center py-8 text-warmgray text-sm">
          아직 작성한 서평이 없어요
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {reviews.map((review) => {
            const content = review.content as unknown as Record<string, unknown>;
            const book = books.find((b) => b.id === review.book_id);
            return (
              <div
                key={review.id}
                className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {book?.title || "책 제목"}
                    </p>
                    <p className="text-xs text-warmgray">{book?.author}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-badge bg-ink-green/10 text-ink-green font-semibold">
                    {review.mode === "essay" ? "📝 에세이" : "📋 구조"}
                  </span>
                </div>
                <p className="text-xs text-ink leading-body line-clamp-3">
                  {(content.oneliner as string) || (content.body as string) || ""}
                </p>
                <p className="text-[10px] text-warmgray-light mt-2">
                  {new Date(review.created_at).toLocaleDateString("ko")}
                  {review.is_public ? " · 공개" : " · 비공개"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Logout */}
      <Button
        onClick={handleLogout}
        variant="outline"
        className="w-full border-terra text-terra hover:bg-terra/5 rounded-btn h-10 mb-8"
      >
        <LogOut className="w-4 h-4 mr-2" />
        로그아웃
      </Button>
    </div>
  );
}
