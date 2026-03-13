"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { getBooks, getReviewsByUser, getTotalMessageCount, upsertProfile } from "@/lib/supabase/queries";
import { useRouter } from "next/navigation";
import type { Review } from "@/lib/types";
import { LogOut, BookOpen, PenLine, MessageCircle, Pencil, Check, X } from "lucide-react";
import { AVATARS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { books, setBooks } = useLibraryStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [saving, setSaving] = useState(false);
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

  const startEditProfile = () => {
    setEditNickname(user?.nickname || "");
    setEditEmoji(user?.emoji || "🦊");
    setEditMode(true);
  };

  const saveProfile = async () => {
    if (!user || !editNickname.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const updated = await upsertProfile(supabase, {
        id: user.id,
        nickname: editNickname.trim(),
        emoji: editEmoji,
      });
      setUser(updated);
      setEditMode(false);
      toast.success("프로필을 수정했어요");
    } catch {
      toast.error("수정에 실패했어요");
    }
    setSaving(false);
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
      <div className="bg-warm rounded-card border border-[rgba(43,76,63,0.08)] shadow-card p-6 mb-6 text-center relative">
        {editMode ? (
          <>
            {/* Emoji picker */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setEditEmoji(emoji)}
                  className={`text-3xl w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    editEmoji === emoji ? "bg-ink-green/15 ring-2 ring-ink-green scale-110" : "hover:bg-ink-green/5"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {/* Nickname input */}
            <input
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              maxLength={20}
              placeholder="닉네임"
              className="w-48 mx-auto text-center text-lg font-black text-ink-green bg-paper border border-[rgba(43,76,63,0.15)] rounded-btn px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ink-green/30"
            />
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setEditMode(false)}
                disabled={saving}
                className="flex items-center gap-1 px-4 py-2 rounded-btn border border-warmgray/30 text-warmgray text-sm font-medium hover:bg-warmgray/5"
              >
                <X className="w-4 h-4" /> 취소
              </button>
              <button
                onClick={saveProfile}
                disabled={saving || !editNickname.trim()}
                className="flex items-center gap-1 px-4 py-2 rounded-btn bg-ink-green text-paper text-sm font-semibold hover:bg-ink-green/90 disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">{user?.emoji || "🦊"}</div>
            <h1 className="text-xl font-black text-ink-green truncate max-w-[240px] mx-auto">{user?.nickname || "독서가"}</h1>
            <p className="text-xs text-warmgray mt-1">
              {new Date(user?.created_at || "").toLocaleDateString("ko")} 가입
            </p>
            <button
              onClick={startEditProfile}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink-green/10 text-warmgray hover:text-ink-green transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </>
        )}
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
