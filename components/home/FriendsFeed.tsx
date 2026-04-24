"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { Scrap, Book } from "@/lib/types";
import { getAvatarSrc } from "@/lib/types";

// 통합 피드 아이템 (내 스크랩 + 모임 스크랩 공통 shape)
export interface FeedItem {
  id: string;
  text: string;
  bookId: string | null;
  bookTitle: string | null;
  bookAuthor: string | null;
  pageNumber: number | null;
  createdAt: string;
  // 작성자 정보 (내 스크랩이면 내 정보, 모임이면 멤버 정보)
  authorNickname: string;
  authorEmoji: string | null;
  isMine: boolean;
}

export interface GroupScrapShape {
  id: string;
  text: string;
  memo: string | null;
  page_number: number | null;
  created_at: string;
  user_id: string;
  author_nickname: string;
  author_emoji: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일`;
  return new Date(iso).toLocaleDateString("ko", { month: "short", day: "numeric" });
}

function initialOf(nick: string): string {
  if (!nick) return "나";
  return nick.charAt(0);
}

/**
 * FriendsFeed — "친구들의 오늘" 섹션.
 * 내가 최근 그은 문장 + 같이 읽는 모임 멤버들의 스크랩을 섞어 최신순 정렬.
 * 빈 상태면 렌더 전체 생략 (부모가 길이 체크).
 */
export default function FriendsFeed({
  myScraps,
  groupScraps,
  books,
  currentUserNickname,
  currentUserEmoji,
  currentUserId,
  limit = 3,
  onMoreTap,
  showEmpty = false,
  onAddScrap,
}: {
  myScraps: Scrap[];
  groupScraps: GroupScrapShape[];
  books: Book[];
  currentUserNickname?: string | null;
  currentUserEmoji?: string | null;
  currentUserId?: string | null;
  limit?: number;
  onMoreTap?: () => void;
  /** true면 items가 비어도 컴포넌트를 렌더하고 빈 상태 UI를 보여줍니다. */
  showEmpty?: boolean;
  /** 빈 상태 CTA에서 호출 — 스크랩 추가 플로우로 이동하는 용도 */
  onAddScrap?: () => void;
}) {
  const router = useRouter();

  // 책 id → (title, author) 매핑
  const bookMap = useMemo(() => {
    const m = new Map<string, { title: string; author: string | null }>();
    for (const b of books) m.set(b.id, { title: b.title, author: b.author });
    return m;
  }, [books]);

  const items = useMemo<FeedItem[]>(() => {
    const mine: FeedItem[] = myScraps.map((s) => {
      const b = s.book_id ? bookMap.get(s.book_id) : null;
      return {
        id: `mine-${s.id}`,
        text: s.text,
        bookId: s.book_id,
        bookTitle: s.book_title || b?.title || null,
        bookAuthor: s.book_author || b?.author || null,
        pageNumber: s.page_number,
        createdAt: s.created_at,
        authorNickname: currentUserNickname || "나",
        authorEmoji: currentUserEmoji || null,
        isMine: true,
      };
    });

    const group: FeedItem[] = groupScraps
      // 내 것은 mine에서 이미 포함됐을 수 있으니 중복 방지
      .filter((g) => !currentUserId || g.user_id !== currentUserId)
      .map((g) => {
        // 모임 스크랩은 book_id가 없으니 bookMap에서 조회 불가 → 제목 생략
        return {
          id: `group-${g.id}`,
          text: g.text,
          bookId: null,
          bookTitle: null,
          bookAuthor: null,
          pageNumber: g.page_number,
          createdAt: g.created_at,
          authorNickname: g.author_nickname,
          authorEmoji: g.author_emoji || null,
          isMine: false,
        };
      });

    return [...mine, ...group]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }, [myScraps, groupScraps, bookMap, currentUserNickname, currentUserEmoji, currentUserId, limit]);

  if (items.length === 0 && !showEmpty) return null;

  // 빈 상태: 세그먼트 탭 등에서 "보여는 주되 비어있다"고 알려야 할 때
  if (items.length === 0 && showEmpty) {
    return (
      <div
        style={{
          background: "var(--sf)",
          borderRadius: 18,
          border: "0.5px solid var(--bd)",
          padding: "28px 20px",
          textAlign: "center",
          marginBottom: 12,
          transition:
            "background var(--duration-slow) var(--easing-default), border-color var(--duration-slow) var(--easing-default)",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            margin: "0 auto 12px",
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--ac) 10%, var(--sf2))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
          }}
          aria-hidden
        >
          ✍️
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--tp)",
            marginBottom: 4,
            letterSpacing: "-0.01em",
          }}
        >
          아직 오늘 그은 문장이 없어요
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--tm)",
            lineHeight: 1.5,
            marginBottom: onAddScrap ? 14 : 0,
          }}
        >
          책에서 마음에 든 문장을 그으면
          <br />
          여기에 나의 오늘이 기록돼요
        </div>
        {onAddScrap && (
          <button
            type="button"
            onClick={onAddScrap}
            style={{
              padding: "9px 18px",
              borderRadius: 100,
              border: "none",
              background: "var(--ac)",
              color: "var(--acc)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              transition: "opacity var(--duration-fast) var(--easing-default)",
            }}
          >
            문장 긋기 시작
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 섹션 헤더 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 2px 10px",
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--tp)",
            letterSpacing: "-0.01em",
          }}
        >
          친구들의 오늘
        </span>
        {onMoreTap && (
          <button
            type="button"
            onClick={onMoreTap}
            style={{
              fontSize: 11,
              color: "var(--ts)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 3,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 2px",
              fontFamily: "inherit",
            }}
          >
            더보기 <ChevronRight size={10} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* 피드 카드 */}
      <div
        style={{
          background: "var(--sf)",
          borderRadius: 18,
          border: "0.5px solid var(--bd)",
          padding: "4px 14px",
          marginBottom: 12,
          boxShadow: "0 2px 8px color-mix(in srgb, var(--tp) 3%, transparent)",
          transition:
            "background var(--duration-slow) var(--easing-default), border-color var(--duration-slow) var(--easing-default)",
        }}
      >
        {items.map((item, idx) => {
          const avatarSrc = getAvatarSrc(item.authorEmoji || undefined);
          const isLast = idx === items.length - 1;
          const canNav = !!item.bookId;

          return (
            <div
              key={item.id}
              onClick={() => canNav && router.push(`/book/${item.bookId!}`)}
              role={canNav ? "button" : undefined}
              tabIndex={canNav ? 0 : undefined}
              onKeyDown={(e) => {
                if (canNav && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  router.push(`/book/${item.bookId!}`);
                }
              }}
              style={{
                display: "flex",
                gap: 11,
                padding: "13px 0",
                borderBottom: isLast ? "none" : "1px solid var(--bd)",
                cursor: canNav ? "pointer" : "default",
              }}
            >
              {/* 아바타 */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  minWidth: 36,
                  borderRadius: "50%",
                  background: "color-mix(in srgb, var(--ac) 14%, var(--sf))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ac)",
                  flexShrink: 0,
                  fontFamily: "var(--font-playful)",
                  overflow: "hidden",
                }}
              >
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : item.authorEmoji && /[\u2600-\u27BF\ud83c-\ud83e]/.test(item.authorEmoji) ? (
                  <span style={{ fontSize: 18 }}>{item.authorEmoji}</span>
                ) : (
                  initialOf(item.authorNickname)
                )}
              </div>

              {/* 본문 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 3,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--tp)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {item.authorNickname}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ts)" }}>
                    · {item.isMine ? "내가 그은 문장" : "문장을 그었어요"}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--tm)",
                      marginLeft: "auto",
                      flexShrink: 0,
                    }}
                  >
                    {timeAgo(item.createdAt)}
                  </span>
                </div>

                {item.bookTitle && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ac)",
                      fontWeight: 600,
                      marginBottom: 6,
                      letterSpacing: "-0.01em",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.bookTitle}
                    {item.bookAuthor ? ` · ${item.bookAuthor}` : ""}
                    {item.pageNumber ? ` · p.${item.pageNumber}` : ""}
                  </div>
                )}

                <div
                  style={{
                    background: "var(--sf2)",
                    borderRadius: 10,
                    padding: "9px 12px",
                    fontFamily: "var(--font-playful)",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--tp)",
                    position: "relative",
                    letterSpacing: "var(--ls-gaegu)",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    transition:
                      "background var(--duration-slow) var(--easing-default)",
                  }}
                >
                  {item.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
