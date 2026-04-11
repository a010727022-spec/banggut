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

    // 1) ItemSearch로 검색
    const searchUrl =
      `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?` +
      `ttbkey=${ttbKey}` +
      `&Query=${encodeURIComponent(query)}` +
      `&QueryType=Keyword` +
      `&MaxResults=5` +
      `&output=js` +
      `&Version=20131101`;

    const res = await fetch(searchUrl);
    if (!res.ok) {
      console.error("[search-book] Aladin API error:", res.status);
      return NextResponse.json({ books: [] }, { status: 500 });
    }

    const data = await res.json();
    const items = data.item || [];

    // 2) ISBN이 있는 항목은 ItemLookup으로 쪽수 조회 (병렬)
    const books = await Promise.all(
      items.map(
        async (book: {
          title: string;
          author: string;
          publisher: string;
          pubDate: string;
          cover: string;
          description: string;
          isbn13: string;
          isbn: string;
          categoryName: string;
        }) => {
          const isbn = book.isbn13 || book.isbn;
          let pageCount: number | null = null;

          if (isbn) {
            try {
              const lookupUrl =
                `http://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?` +
                `ttbkey=${ttbKey}` +
                `&itemIdType=ISBN13` +
                `&ItemId=${isbn}` +
                `&output=js` +
                `&Version=20131101` +
                `&OptResult=packing`;
              const lookupRes = await fetch(lookupUrl);
              if (lookupRes.ok) {
                const lookupData = await lookupRes.json();
                const subInfo = lookupData.item?.[0]?.subInfo;
                if (subInfo?.itemPage) {
                  pageCount = parseInt(subInfo.itemPage, 10) || null;
                }
              }
            } catch {
              // 쪽수 조회 실패해도 무시
            }
          }

          // cover500 = 알라딘 500px 고화질 이미지
          const coverHQ = book.cover
            ? book.cover
                .replace("/cover/", "/cover500/")
                .replace("/cover200/", "/cover500/")
                .replace("/coversum/", "/cover500/")
                .replace("http://", "https://")
            : book.cover;

          return {
            title: book.title,
            author: book.author,
            publisher: book.publisher,
            pubDate: book.pubDate,
            cover: coverHQ,
            description: book.description,
            isbn,
            category: book.categoryName,
            pageCount,
          };
        },
      ),
    );

    return NextResponse.json({ books });
  } catch (error) {
    console.error("[search-book] error:", error);
    return NextResponse.json({ books: [] }, { status: 500 });
  }
}
