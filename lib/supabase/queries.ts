import { SupabaseClient } from "@supabase/supabase-js";
import type { Book, Message, Scrap, Underline, Review, User } from "@/lib/types";

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
export async function getBooks(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return (data || []) as Book[];
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
export async function getScraps(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("scraps")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
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

export async function deleteScrap(supabase: SupabaseClient, scrapId: string) {
  const { error } = await supabase.from("scraps").delete().eq("id", scrapId);
  if (error) throw error;
}

export async function getScrapsByBook(supabase: SupabaseClient, bookId: string) {
  const { data } = await supabase
    .from("scraps")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
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

export async function getReviewsByUser(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data || []) as Review[];
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
  const [books, totalMessageCount, reviews] = await Promise.all([
    getBooks(supabase, userId),
    getTotalMessageCount(supabase, userId),
    getReviewsByUser(supabase, userId),
  ]);

  const totalBooks = books.length;
  const booksByPhase = {
    0: books.filter((b) => b.phase === 0).length,
    1: books.filter((b) => b.phase === 1).length,
    2: books.filter((b) => b.phase === 2).length,
    3: books.filter((b) => b.phase === 3).length,
  };

  return {
    totalBooks,
    booksByPhase,
    totalMessageCount,
    reviewCount: reviews.length,
  };
}
