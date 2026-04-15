import { SupabaseClient } from "@supabase/supabase-js";
import type { Book, Message, Scrap, Underline, Review, User, ReadingSession } from "@/lib/types";

// --- Users ---
export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("[getProfile] error:", error.message, error.code, "userId:", userId);
  }
  return data as User | null;
}

export async function upsertProfile(supabase: SupabaseClient, user: Partial<User> & { id: string }) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(user)
    .select()
    .single();
  if (error) throw error;
  return data as User;
}

// --- Books ---
/**
 * 유저 서재 책 목록.
 * 기본 limit 200 — 99%의 유저는 이 선을 안 넘음.
 * 더 많은 책이 있는 유저는 limit을 늘리거나 range로 페이징.
 */
export async function getBooks(
  supabase: SupabaseClient,
  userId: string,
  options?: { limit?: number; offset?: number },
) {
  const { limit = 200, offset = 0 } = options || {};
  const { data } = await supabase
    .from("books")
    .select("*, group_books(id, group_id, weeks_data, start_date, end_date, round_number, status, reading_groups(id, name))")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return (data || []) as Book[];
}

/**
 * 유저 책 수만 필요한 경우 (통계/대시보드).
 * getBooks()로 전체를 불러와서 .length 재는 것보다 훨씬 가벼움.
 */
export async function getBookCount(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count || 0;
}

export async function getBook(supabase: SupabaseClient, bookId: string) {
  const { data } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .single();
  return data as Book | null;
}

export async function createBook(supabase: SupabaseClient, book: Pick<Book, "user_id" | "title" | "author"> & Partial<Book>) {
  const { data, error } = await supabase
    .from("books")
    .insert(book)
    .select()
    .single();
  if (error) throw error;
  return data as Book;
}

export async function updateBook(supabase: SupabaseClient, bookId: string, updates: Partial<Book>) {
  const { data, error } = await supabase
    .from("books")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", bookId)
    .select()
    .single();
  if (error) throw error;
  return data as Book;
}

export async function deleteBook(supabase: SupabaseClient, bookId: string) {
  // 관련 데이터도 cascade 또는 수동 삭제
  await supabase.from("messages").delete().eq("book_id", bookId);
  await supabase.from("underlines").delete().eq("book_id", bookId);
  await supabase.from("reviews").delete().eq("book_id", bookId);
  const { error } = await supabase.from("books").delete().eq("id", bookId);
  if (error) throw error;
}

// --- Messages ---
export async function getMessages(supabase: SupabaseClient, bookId: string) {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });
  return (data || []) as Message[];
}

export async function addMessage(supabase: SupabaseClient, message: Omit<Message, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("messages")
    .insert(message)
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export async function getTotalMessageCount(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from("messages")
    .select("id, books!inner(user_id)", { count: "exact", head: true })
    .eq("books.user_id", userId);
  return count || 0;
}

// --- Scraps ---
export async function getScraps(supabase: SupabaseClient, userId: string, limit?: number) {
  let query = supabase
    .from("scraps")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data } = await query;
  return (data || []) as Scrap[];
}

export async function createScrap(supabase: SupabaseClient, scrap: Omit<Scrap, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("scraps")
    .insert(scrap)
    .select()
    .single();
  if (error) throw error;
  return data as Scrap;
}

export async function createScraps(
  supabase: SupabaseClient,
  scraps: Omit<Scrap, "id" | "created_at">[],
) {
  const { data, error } = await supabase.from("scraps").insert(scraps).select();
  if (error) throw error;
  return data as Scrap[];
}

export async function deleteScrap(supabase: SupabaseClient, scrapId: string) {
  const { error } = await supabase.from("scraps").delete().eq("id", scrapId);
  if (error) throw error;
}

export async function updateScrap(supabase: SupabaseClient, scrapId: string, updates: Partial<Pick<Scrap, "text" | "memo" | "page_number">>) {
  const { data, error } = await supabase
    .from("scraps")
    .update(updates)
    .eq("id", scrapId)
    .select()
    .single();
  if (error) throw error;
  return data as Scrap;
}

export async function getScrapsByBook(
  supabase: SupabaseClient,
  bookId: string,
  options?: { limit?: number; offset?: number },
) {
  const { limit = 500, offset = 0 } = options || {};
  const { data } = await supabase
    .from("scraps")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return (data || []) as Scrap[];
}

export async function getScrapsUnfiled(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("scraps")
    .select("*")
    .eq("user_id", userId)
    .is("book_id", null)
    .order("created_at", { ascending: false });
  return (data || []) as Scrap[];
}

export async function getScrapCountsByBook(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("scraps")
    .select("book_id")
    .eq("user_id", userId);
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const key = (row as { book_id: string | null }).book_id ?? "__unfiled__";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// --- Underlines ---
export async function getUnderlines(supabase: SupabaseClient, bookId: string) {
  const { data } = await supabase
    .from("underlines")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });
  return (data || []) as Underline[];
}

export async function createUnderline(supabase: SupabaseClient, underline: Omit<Underline, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("underlines")
    .insert(underline)
    .select()
    .single();
  if (error) throw error;
  return data as Underline;
}

// --- Reviews ---
export async function getReview(supabase: SupabaseClient, bookId: string) {
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("book_id", bookId)
    .single();
  return data as Review | null;
}

export async function getReviewsByUser(
  supabase: SupabaseClient,
  userId: string,
  options?: { limit?: number; offset?: number },
) {
  const { limit = 100, offset = 0 } = options || {};
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return (data || []) as Review[];
}

/** 유저가 작성한 서평 수 (통계용) */
export async function getReviewCount(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count || 0;
}

export async function upsertReview(supabase: SupabaseClient, review: Omit<Review, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("reviews")
    .upsert(review, { onConflict: "book_id" })
    .select()
    .single();
  if (error) throw error;
  return data as Review;
}

export async function deleteReview(supabase: SupabaseClient, bookId: string) {
  const { error } = await supabase.from("reviews").delete().eq("book_id", bookId);
  if (error) throw error;
}

// --- Public Review Feed ---
export interface PublicReviewItem {
  id: string;
  book_id: string;
  user_id: string;
  mode: "essay" | "structured";
  content: Review["content"];
  is_public: boolean;
  created_at: string;
  rating: number | null;
  book_title: string;
  book_author: string | null;
  book_cover_url: string | null;
  author_nickname: string;
  author_emoji: string;
}

export async function getPublicReviews(
  supabase: SupabaseClient,
  limit: number = 20,
  offset: number = 0,
): Promise<PublicReviewItem[]> {
  const { data } = await supabase
    .from("reviews")
    .select("*, books(title, author, cover_url, rating), profiles!reviews_user_id_fkey(nickname, emoji)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((d: any) => {
    const book = Array.isArray(d.books) ? d.books[0] : d.books;
    const prof = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
    return {
      id: d.id,
      book_id: d.book_id,
      user_id: d.user_id,
      mode: d.mode,
      content: d.content,
      is_public: d.is_public,
      created_at: d.created_at,
      rating: book?.rating ?? null,
      book_title: book?.title ?? "책 제목",
      book_author: book?.author ?? null,
      book_cover_url: book?.cover_url ?? null,
      author_nickname: prof?.nickname ?? "독자",
      author_emoji: prof?.emoji ?? "",
    } as PublicReviewItem;
  });
}

// --- Reading Sessions ---
export async function getReadingSessions(supabase: SupabaseClient, userId: string, from?: string, to?: string) {
  let query = supabase
    .from("reading_sessions")
    .select("*, books(title, author, cover_url)")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  const { data } = await query;
  return (data || []) as (ReadingSession & { books: Pick<Book, "title" | "author" | "cover_url"> })[];
}

export async function upsertReadingSession(supabase: SupabaseClient, session: Omit<ReadingSession, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("reading_sessions")
    .upsert(session, { onConflict: "book_id,date" })
    .select()
    .single();
  if (error) throw error;
  return data as ReadingSession;
}

// --- Reading Streaks ---
export async function getStreaks(supabase: SupabaseClient, userId: string, from: string, to: string) {
  const { data } = await supabase
    .from("reading_streaks")
    .select("date, activities")
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to);
  return (data || []) as { date: string; activities: Record<string, unknown> }[];
}

export async function getAllStreakDates(supabase: SupabaseClient, userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().split("T")[0];
  const { data } = await supabase
    .from("reading_streaks")
    .select("date")
    .eq("user_id", userId)
    .gte("date", sinceStr)
    .order("date", { ascending: false });
  return (data || []).map((d) => d.date as string);
}

export async function upsertStreak(
  supabase: SupabaseClient,
  userId: string,
  activity: Record<string, unknown>,
) {
  const today = new Date().toISOString().split("T")[0];

  // 먼저 upsert로 row 확보 (race condition 방지)
  const { data: row } = await supabase
    .from("reading_streaks")
    .upsert(
      { user_id: userId, date: today, activities: activity },
      { onConflict: "user_id,date", ignoreDuplicates: true },
    )
    .select("activities")
    .single();

  // ignoreDuplicates=true면 기존 row가 있으면 insert 안 됨 → 병합 필요
  if (row) {
    const prev = (row.activities || {}) as Record<string, unknown>;
    // 이미 새로 insert된 경우 prev === activity → 병합 불필요
    const needsMerge = prev !== activity && Object.keys(prev).length > 0 &&
      JSON.stringify(prev) !== JSON.stringify(activity);
    if (!needsMerge) return;
  }

  // 기존 데이터 가져와서 병합
  const { data: existing } = await supabase
    .from("reading_streaks")
    .select("activities")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  if (!existing) return;

  const prev = (existing.activities || {}) as Record<string, unknown>;
  const merged = { ...prev, ...activity };

  if (Array.isArray(activity.read) && Array.isArray(prev.read)) {
    merged.read = Array.from(new Set((prev.read as string[]).concat(activity.read as string[])));
  }
  if (Array.isArray(activity.books)) {
    const prevBooks = Array.isArray(prev.books) ? [...(prev.books as { bookId: string }[])] : [];
    const newBooks = activity.books as { bookId: string }[];
    for (const nb of newBooks) {
      const idx = prevBooks.findIndex((b) => b.bookId === nb.bookId);
      if (idx >= 0) prevBooks[idx] = { ...prevBooks[idx], ...nb };
      else prevBooks.push(nb);
    }
    merged.books = prevBooks;
  }

  await supabase
    .from("reading_streaks")
    .update({ activities: merged })
    .eq("user_id", userId)
    .eq("date", today);
}

// --- Aggregated Queries ---
export async function getMessageCountForBook(supabase: SupabaseClient, bookId: string) {
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("book_id", bookId);
  return count || 0;
}

export async function getScrapCountForBook(supabase: SupabaseClient, bookTitle: string) {
  const { count } = await supabase
    .from("scraps")
    .select("id", { count: "exact", head: true })
    .eq("book_title", bookTitle);
  return count || 0;
}

export async function getBookWithCounts(supabase: SupabaseClient, bookId: string) {
  const book = await getBook(supabase, bookId);
  if (!book) return null;

  const [messageCount, scrapCount] = await Promise.all([
    getMessageCountForBook(supabase, bookId),
    getScrapCountForBook(supabase, book.title),
  ]);

  return {
    ...book,
    message_count: messageCount,
    scrap_count: scrapCount,
  } as Book;
}

export async function getBookStats(supabase: SupabaseClient, userId: string) {
  // 각 테이블을 count(head)로 조회 — 실제 row를 내려받지 않으므로 가벼움
  const [totalBooks, totalMessageCount, reviewCount] = await Promise.all([
    getBookCount(supabase, userId),
    getTotalMessageCount(supabase, userId),
    getReviewCount(supabase, userId),
  ]);

  return {
    totalBooks,
    totalMessageCount,
    reviewCount,
  };
}

/* ═══ 독서 모임 ═══ */

import type { ReadingGroup, GroupMember, GroupBook, GroupSchedule } from "@/lib/types";

export async function getMyGroups(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("group_members")
    .select("group_id, role, reading_groups(*)")
    .eq("user_id", userId);
  return (data || []).map((d) => ({
    ...(d.reading_groups as unknown as ReadingGroup),
    myRole: d.role as string,
  }));
}

export async function getGroup(supabase: SupabaseClient, groupId: string) {
  const { data } = await supabase
    .from("reading_groups")
    .select("*")
    .eq("id", groupId)
    .single();
  return data as ReadingGroup | null;
}

export async function getGroupByInviteCode(supabase: SupabaseClient, code: string) {
  const { data } = await supabase
    .from("reading_groups")
    .select("*")
    .eq("invite_code", code.toUpperCase())
    .single();
  return data as ReadingGroup | null;
}

export async function createGroup(supabase: SupabaseClient, group: Omit<ReadingGroup, "id" | "invite_code" | "created_at">) {
  const { data, error } = await supabase
    .from("reading_groups")
    .insert(group)
    .select()
    .single();
  if (error) throw error;
  return data as ReadingGroup;
}

export async function joinGroup(supabase: SupabaseClient, groupId: string, userId: string, role: string = "member") {
  const { error } = await supabase
    .from("group_members")
    .upsert({ group_id: groupId, user_id: userId, role }, { onConflict: "group_id,user_id" });
  if (error) throw error;

  // 현재 진행 중인 책이 있으면 서재에 자동 추가
  const { data: currentBook } = await supabase
    .from("group_books")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "reading")
    .single();

  if (currentBook) {
    await addGroupBookToUserLibrary(supabase, userId, currentBook as GroupBook);
  }
}

export async function leaveGroup(supabase: SupabaseClient, groupId: string, userId: string) {
  // group_book_id만 null로 (데이터 보존, 개인 책으로 계속 읽기 가능)
  const { data: groupBooks } = await supabase
    .from("group_books")
    .select("id")
    .eq("group_id", groupId);
  if (groupBooks?.length) {
    const gbIds = groupBooks.map((gb) => gb.id);
    await supabase
      .from("books")
      .update({ group_book_id: null })
      .eq("user_id", userId)
      .in("group_book_id", gbIds);
  }

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getGroupMembers(supabase: SupabaseClient, groupId: string) {
  const { data } = await supabase
    .from("group_members")
    .select("*, profiles(id, nickname, emoji)")
    .eq("group_id", groupId)
    .order("joined_at");
  return (data || []) as GroupMember[];
}

export async function getGroupBooks(supabase: SupabaseClient, groupId: string) {
  const { data } = await supabase
    .from("group_books")
    .select("*")
    .eq("group_id", groupId)
    .order("round_number", { ascending: false });
  return (data || []) as GroupBook[];
}

export async function createGroupBook(supabase: SupabaseClient, book: Omit<GroupBook, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("group_books")
    .insert(book)
    .select()
    .single();
  if (error) throw error;

  const groupBook = data as GroupBook;

  // 멤버 전원 서재에 책 자동 추가
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", book.group_id);

  if (members) {
    await Promise.all(
      members.map((m) => addGroupBookToUserLibrary(supabase, m.user_id, groupBook))
    );
  }

  return groupBook;
}

/** 모임 책을 유저 서재에 추가 (이미 있으면 연결만) */
async function addGroupBookToUserLibrary(
  supabase: SupabaseClient,
  userId: string,
  groupBook: GroupBook,
) {
  // ISBN으로 이미 서재에 있는지 체크
  let existing = null;
  if (groupBook.book_isbn) {
    const { data } = await supabase
      .from("books")
      .select("id")
      .eq("user_id", userId)
      .eq("isbn", groupBook.book_isbn)
      .single();
    existing = data;
  }
  // 제목+저자로도 체크
  if (!existing) {
    const { data } = await supabase
      .from("books")
      .select("id")
      .eq("user_id", userId)
      .eq("title", groupBook.book_title)
      .single();
    existing = data;
  }

  if (existing) {
    // 이미 있으면 group_book_id 연결 + 읽는 중으로
    await supabase
      .from("books")
      .update({ group_book_id: groupBook.id, reading_status: "reading" })
      .eq("id", existing.id);
  } else {
    // 없으면 새로 추가
    await supabase.from("books").insert({
      user_id: userId,
      title: groupBook.book_title,
      author: groupBook.book_author,
      cover_url: groupBook.book_cover_url,
      total_pages: (groupBook as GroupBook & { total_pages?: number }).total_pages || null,
      current_page: 0,
      reading_status: "reading",
      started_at: groupBook.start_date || new Date().toISOString().split("T")[0],
      group_book_id: groupBook.id,
      format: "paper",
    });
  }
}

export async function getGroupSchedules(supabase: SupabaseClient, groupId: string) {
  const { data } = await supabase
    .from("group_schedules")
    .select("*")
    .eq("group_id", groupId)
    .order("date");
  return (data || []) as GroupSchedule[];
}

export async function createGroupSchedule(supabase: SupabaseClient, schedule: Omit<GroupSchedule, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("group_schedules")
    .insert(schedule)
    .select()
    .single();
  if (error) throw error;
  return data as GroupSchedule;
}

export async function getMemberCount(supabase: SupabaseClient, groupId: string) {
  const { count } = await supabase
    .from("group_members")
    .select("user_id", { count: "exact", head: true })
    .eq("group_id", groupId);
  return count || 0;
}

/**
 * 사용자가 아직 참가하지 않은 공개 모임 목록.
 * nested select로 멤버 수 + 현재 읽는 책을 단일 쿼리로 가져와 N+1 제거.
 */
export async function getPublicGroups(supabase: SupabaseClient, userId: string) {
  // 이미 참가 중인 group_id 목록
  const { data: myMemberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);
  const myGroupIds = (myMemberships || []).map((m) => m.group_id as string);

  // 단일 쿼리: 그룹 + 멤버 수(count) + 현재 읽는 책
  let query = supabase
    .from("reading_groups")
    .select(
      "id, name, description, group_members(count), group_books(book_title, book_author, status)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  // 이미 참가한 그룹 제외
  if (myGroupIds.length > 0) {
    query = query.not("id", "in", `(${myGroupIds.join(",")})`);
  }

  const { data: groups } = await query;
  if (!groups || groups.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (groups as any[]).map((g) => {
    // group_members(count): [{ count: N }] 형태
    const memberCount = Array.isArray(g.group_members) && g.group_members[0]
      ? (g.group_members[0].count as number) || 0
      : 0;

    // group_books: 전체 책 중 status='reading'만 필터
    const readingBook = Array.isArray(g.group_books)
      ? g.group_books.find((b: { status: string }) => b.status === "reading")
      : null;

    return {
      id: g.id as string,
      name: g.name as string,
      description: g.description as string | null,
      memberCount,
      currentBookTitle: (readingBook?.book_title as string) || null,
      currentBookAuthor: (readingBook?.book_author as string) || null,
    };
  });
}

/* ═══ 라이브 독서 ═══ */

export interface LiveReader {
  user_id: string;
  book_id: string | null;
  group_id: string | null;
  current_page: number | null;
  total_pages: number | null;
  started_at: string;
  last_active_at: string;
  profiles?: { id: string; nickname: string; emoji: string };
}

// 라이브 시작/업데이트
export async function upsertLive(
  supabase: SupabaseClient,
  userId: string,
  bookId: string | null,
  groupId: string | null,
  currentPage: number | null,
  totalPages: number | null,
) {
  const { data, error } = await supabase
    .from("reading_live")
    .upsert({
      user_id: userId,
      book_id: bookId,
      group_id: groupId,
      current_page: currentPage,
      total_pages: totalPages,
      last_active_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 라이브 종료
export async function removeLive(supabase: SupabaseClient, userId: string) {
  await supabase.from("reading_live").delete().eq("user_id", userId);
}

// 그룹의 라이브 리더 목록 (5분 이내 활동)
export async function getGroupLiveReaders(supabase: SupabaseClient, groupId: string) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("reading_live")
    .select("*, profiles(id, nickname, emoji)")
    .eq("group_id", groupId)
    .gte("last_active_at", fiveMinAgo)
    .order("last_active_at", { ascending: false });
  return (data || []) as LiveReader[];
}

// ─── 모임 스크랩 피드 ───
// group_book_id를 공유하는 모든 멤버 책의 scraps + 작성자
export async function getGroupScraps(supabase: SupabaseClient, groupBookId: string) {
  // group_book_id를 가진 멤버 책 id들 모으기
  const { data: bookRows } = await supabase
    .from("books")
    .select("id, user_id, title, profiles(nickname, emoji)")
    .eq("group_book_id", groupBookId);
  if (!bookRows || bookRows.length === 0) return [];
  const bookIds = bookRows.map((b) => b.id);
  const bookMap = new Map(bookRows.map((b) => [b.id, b]));

  const { data: scraps } = await supabase
    .from("scraps")
    .select("*")
    .in("book_id", bookIds)
    .order("created_at", { ascending: false })
    .limit(100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (scraps || []).map((s: any) => {
    const b = bookMap.get(s.book_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prof: any = b ? (Array.isArray(b.profiles) ? b.profiles[0] : b.profiles) : null;
    return {
      id: s.id as string,
      text: s.text as string,
      memo: s.memo as string | null,
      page_number: s.page_number as number | null,
      created_at: s.created_at as string,
      user_id: (b?.user_id as string) || "",
      author_nickname: prof?.nickname || "멤버",
      author_emoji: prof?.emoji || "",
    };
  });
}

// ─── 모임 토론 ───
export interface GroupDiscussion {
  id: string;
  group_id: string;
  group_book_id: string | null;
  author_id: string;
  question: string;
  created_at: string;
  author_nickname?: string;
  author_emoji?: string;
  reply_count?: number;
}

export interface GroupDiscussionReply {
  id: string;
  discussion_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_nickname?: string;
  author_emoji?: string;
}

export async function getGroupDiscussions(
  supabase: SupabaseClient,
  groupId: string,
  options?: { limit?: number; offset?: number },
) {
  const { limit = 50, offset = 0 } = options || {};
  const { data } = await supabase
    .from("group_discussions")
    .select("*, profiles!group_discussions_author_id_fkey(nickname, emoji), group_discussion_replies(id)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((d: any) => {
    const prof = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
    return {
      id: d.id,
      group_id: d.group_id,
      group_book_id: d.group_book_id,
      author_id: d.author_id,
      question: d.question,
      created_at: d.created_at,
      author_nickname: prof?.nickname || "멤버",
      author_emoji: prof?.emoji || "",
      reply_count: Array.isArray(d.group_discussion_replies) ? d.group_discussion_replies.length : 0,
    } as GroupDiscussion;
  });
}

export async function createGroupDiscussion(
  supabase: SupabaseClient,
  payload: { group_id: string; group_book_id: string | null; author_id: string; question: string }
) {
  const { data, error } = await supabase
    .from("group_discussions")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as GroupDiscussion;
}

export async function getDiscussionReplies(supabase: SupabaseClient, discussionId: string) {
  const { data } = await supabase
    .from("group_discussion_replies")
    .select("*, profiles!group_discussion_replies_author_id_fkey(nickname, emoji)")
    .eq("discussion_id", discussionId)
    .order("created_at", { ascending: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((r: any) => {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      discussion_id: r.discussion_id,
      author_id: r.author_id,
      content: r.content,
      created_at: r.created_at,
      author_nickname: prof?.nickname || "멤버",
      author_emoji: prof?.emoji || "",
    } as GroupDiscussionReply;
  });
}

export async function createDiscussionReply(
  supabase: SupabaseClient,
  payload: { discussion_id: string; author_id: string; content: string }
) {
  const { data, error } = await supabase
    .from("group_discussion_replies")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as GroupDiscussionReply;
}

// 그룹 멤버의 책 진행률 (books 테이블에서 직접)
export async function getGroupMemberProgress(supabase: SupabaseClient, groupBookId: string) {
  const { data } = await supabase
    .from("books")
    .select("user_id, current_page, total_pages, reading_status, started_at, updated_at, profiles(id, nickname, emoji)")
    .eq("group_book_id", groupBookId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((d: any) => ({
    user_id: d.user_id as string,
    current_page: d.current_page as number | null,
    total_pages: d.total_pages as number | null,
    reading_status: d.reading_status as string,
    started_at: d.started_at as string | null,
    updated_at: d.updated_at as string | null,
    profiles: Array.isArray(d.profiles) ? d.profiles[0] || null : d.profiles || null,
  })) as {
    user_id: string;
    current_page: number | null;
    total_pages: number | null;
    reading_status: string;
    started_at: string | null;
    updated_at: string | null;
    profiles: { id: string; nickname: string; emoji: string } | null;
  }[];
}
