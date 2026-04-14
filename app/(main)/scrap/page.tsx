"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { getReviewsByUser, getBooks, getAllStreakDates, getPublicReviews } from "@/lib/supabase/queries";
import type { PublicReviewItem } from "@/lib/supabase/queries";
import type { Review } from "@/lib/types";
import { BookOpen, Star, User, Clock } from "lucide-react";
import AppHeader from "@/components/shared/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLibraryStore } from "@/stores/useLibraryStore";

function upgradeCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace("/cover/", "/cover500/").replace("/cover200/", "/cover500/").replace("/coversum/", "/cover500/").replace("http://", "https://");
}

const COVER_PALETTES = [["#90C4E4","#2B6CB0"],["#7FAF8A","#2B4C3F"],["#C4A35A","#8B6F3C"],["#F0A8C4","#B0557A"],["#94B8B0","#3D6B5A"],["#B8A9D4","#5B4A8A"]];
const coverPalette = (t: string) => COVER_PALETTES[t.charCodeAt(0) % COVER_PALETTES.length];

type FeedTab = "feed" | "mine";

export default function ReviewFeedPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { books, setBooks } = useLibraryStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [streakDates, setStreakDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FeedTab>("feed");

  // Feed state
  const [feedItems, setFeedItems] = useState<PublicReviewItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedOffset, setFeedOffset] = useState(0);
  const FEED_PAGE_SIZE = 20;

  const counts = {
    reading: books.filter(b => b.reading_status === "reading").length,
    done: books.filter(b => b.reading_status === "finished").length,
    want: books.filter(b => b.reading_status === "want_to_read" || b.reading_status === "to_read").length,
  };

  const loadFeed = useCallback(async (offset: number, append: boolean) => {
    setFeedLoading(true);
    try {
      const supabase = createClient();
      const items = await getPublicReviews(supabase, FEED_PAGE_SIZE, offset);
      if (append) {
        setFeedItems((prev) => [...prev, ...items]);
      } else {
        setFeedItems(items);
      }
      setFeedHasMore(items.length >= FEED_PAGE_SIZE);
      setFeedOffset(offset + items.length);
    } catch {
      // silent
    } finally {
      setFeedLoading(false);
    }
  }, [FEED_PAGE_SIZE]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      getReviewsByUser(supabase, user.id),
      getBooks(supabase, user.id),
      getAllStreakDates(supabase, user.id),
    ]).then(([r, b, s]) => {
      setReviews(r); setBooks(b); setStreakDates(s);
    }).catch(() => {}).finally(() => setLoading(false));

    // Load feed
    loadFeed(0, false);
  }, [user, setBooks, loadFeed]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "28px 20px" }}>
      <div className="skeleton" style={{ height: 180, borderRadius: 16, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 18 }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 100, transition: "background 0.4s" }}>
      {/* 공통 헤더 */}
      <AppHeader streakDates={streakDates} counts={counts} />

      {/* 피드/내 서평 탭 */}
      <div style={{ display: "flex", borderBottom: "0.5px solid var(--bd)", padding: "4px 20px 0", transition: "border-color 0.4s" }}>
        {(["feed", "mine"] as FeedTab[]).map((t) => {
          const on = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 18px", fontSize: 12, fontWeight: 700,
              color: on ? "var(--ac)" : "var(--tm)",
              cursor: "pointer", position: "relative", border: "none", background: "transparent",
              transition: "color 0.2s",
            }}>
              {t === "feed" ? "피드" : "내 서평"}
              {on && <div style={{ position: "absolute", bottom: -0.5, left: 0, right: 0, height: 2, background: "var(--ac)", borderRadius: "2px 2px 0 0", transition: "background 0.4s" }} />}
            </button>
          );
        })}
      </div>

      {/* ═══ 피드 탭 ═══ */}
      {tab === "feed" && (
        <div style={{ animation: "pageIn 0.2s ease" }}>
          {!feedLoading && feedItems.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="아직 공개된 서평이 없어요"
              description="서평을 작성하고 공개하면 이곳에 표시돼요"
            />
          ) : (
            <>
              {feedItems.map((item) => {
                const coverUrl = upgradeCoverUrl(item.book_cover_url);
                const [bg, fg] = coverPalette(item.book_title);
                const content = item.content as unknown as Record<string, unknown>;
                const excerpt = (content.oneliner as string) || (content.body as string) || "";
                const rating = item.rating || 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/book/${item.book_id}?tab=review`)}
                    style={{
                      display: "flex", gap: 12, padding: "14px 20px",
                      borderBottom: "0.5px solid var(--bd)",
                      cursor: "pointer", alignItems: "flex-start",
                      transition: "background 0.15s, border-color 0.4s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sf)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    {/* 표지 */}
                    <div style={{ width: 40, height: 58, borderRadius: 7, overflow: "hidden", flexShrink: 0, position: "relative" }}>
                      {coverUrl ? (
                        <img src={coverUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg, ${bg}, ${fg})` }} />
                      )}
                    </div>

                    {/* 정보 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)", transition: "color 0.4s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.book_title}
                      </div>
                      {item.book_author && (
                        <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 2, transition: "color 0.4s" }}>
                          {item.book_author}
                        </div>
                      )}
                      {excerpt && (
                        <div style={{
                          fontSize: 11, color: "var(--ts)", marginTop: 4, fontStyle: "italic", lineHeight: 1.5,
                          transition: "color 0.4s",
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          &ldquo;{excerpt}&rdquo;
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        {/* 별점 */}
                        {rating > 0 && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={10}
                                fill={i < Math.floor(rating) ? "#c8a030" : "none"}
                                color="#c8a030"
                                strokeWidth={1.5}
                              />
                            ))}
                          </span>
                        )}
                        {/* 작성자 */}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, color: "var(--tm)", fontWeight: 600, transition: "color 0.4s" }}>
                          <User size={9} strokeWidth={2} />
                          {item.author_nickname}
                        </span>
                        {/* 날짜 */}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, color: "var(--tm)", fontWeight: 600, transition: "color 0.4s" }}>
                          <Clock size={9} strokeWidth={2} />
                          {new Date(item.created_at).toLocaleDateString("ko", { year: "numeric", month: "numeric", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 더 보기 버튼 */}
              {feedHasMore && (
                <div style={{ textAlign: "center", padding: "16px 20px" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); loadFeed(feedOffset, true); }}
                    disabled={feedLoading}
                    style={{
                      padding: "10px 24px", fontSize: 12, fontWeight: 700,
                      color: "var(--ac)", background: "var(--sf)", border: "1px solid var(--bd)",
                      borderRadius: 10, cursor: feedLoading ? "not-allowed" : "pointer",
                      opacity: feedLoading ? 0.5 : 1,
                      transition: "all 0.2s",
                    }}
                  >
                    {feedLoading ? "불러오는 중..." : "더 보기"}
                  </button>
                </div>
              )}

              {/* 로딩 중 (최초) */}
              {feedLoading && feedItems.length === 0 && (
                <div style={{ padding: "32px 20px", textAlign: "center" }}>
                  <div className="skeleton" style={{ height: 60, borderRadius: 10, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 60, borderRadius: 10, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 60, borderRadius: 10 }} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ 내 서평 탭 ═══ */}
      {tab === "mine" && (
        <div style={{ animation: "pageIn 0.2s ease" }}>
          {reviews.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="아직 서평이 없어요"
              description="책을 읽고 느낌을 남겨보세요"
            />
          ) : (
            reviews.map((review) => {
              const content = review.content as unknown as Record<string, unknown>;
              const book = books.find((b) => b.id === review.book_id);
              const coverUrl = upgradeCoverUrl(book?.cover_url);
              const [bg, fg] = coverPalette(book?.title || "");
              const oneLiner = (content.oneliner as string) || (content.body as string) || "";
              const rating = (content.rating as number) || book?.rating || 0;

              return (
                <div key={review.id}
                  onClick={() => router.push(`/book/${review.book_id}?tab=review`)}
                  style={{
                    display: "flex", gap: 12, padding: "12px 20px",
                    borderBottom: "0.5px solid var(--bd)",
                    cursor: "pointer", alignItems: "center",
                    transition: "background 0.15s, border-color 0.4s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sf)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {/* 표지 */}
                  <div style={{ width: 40, height: 58, borderRadius: 7, overflow: "hidden", flexShrink: 0, position: "relative" }}>
                    {coverUrl ? (
                      <img src={coverUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg, ${bg}, ${fg})` }} />
                    )}
                  </div>

                  {/* 정보 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tp)", transition: "color 0.4s" }}>{book?.title || "책 제목"}</div>
                    {book?.author && <div style={{ fontSize: 10, color: "var(--tm)", marginTop: 2, transition: "color 0.4s" }}>{book.author}</div>}
                    {oneLiner && <div style={{ fontSize: 11, color: "var(--ts)", marginTop: 4, fontStyle: "italic", lineHeight: 1.4, transition: "color 0.4s" }}>&ldquo;{oneLiner}&rdquo;</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                      {/* 별점 */}
                      {rating > 0 && (
                        <span style={{ fontSize: 11, color: "#c8a030" }}>
                          {"★".repeat(Math.floor(rating))}{"☆".repeat(5 - Math.floor(rating))}
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: "var(--tm)", fontWeight: 600, transition: "color 0.4s" }}>
                        {new Date(review.created_at).toLocaleDateString("ko", { year: "numeric", month: "numeric", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
