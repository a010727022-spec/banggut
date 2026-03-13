import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`search:${user.id}`, 20);
  if (!success) return tooManyRequests();

  const { query } = await req.json();

  if (!query || typeof query !== "string" || query.length > 200) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const ttbKey = process.env.ALADIN_TTB_KEY;
    if (!ttbKey) {
      console.error("[search-book] ALADIN_TTB_KEY not set");
      return NextResponse.json({ books: [] }, { status: 500 });
    }

    const url =
      `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?` +
      `ttbkey=${ttbKey}` +
      `&Query=${encodeURIComponent(query)}` +
      `&QueryType=Keyword` +
      `&MaxResults=5` +
      `&output=js` +
      `&Version=20131101`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("[search-book] Aladin API error:", res.status);
      return NextResponse.json({ books: [] }, { status: 500 });
    }

    const data = await res.json();
    const items = data.item || [];

    const books = items.map(
      (book: {
        title: string;
        author: string;
        publisher: string;
        pubDate: string;
        cover: string;
        description: string;
        isbn13: string;
        isbn: string;
        categoryName: string;
      }) => ({
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        pubDate: book.pubDate,
        cover: book.cover,
        description: book.description,
        isbn: book.isbn13 || book.isbn,
        category: book.categoryName,
      }),
    );

    return NextResponse.json({ books });
  } catch (error) {
    console.error("[search-book] error:", error);
    return NextResponse.json({ books: [] }, { status: 500 });
  }
}
