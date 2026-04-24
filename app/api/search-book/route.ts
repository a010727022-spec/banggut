import { NextResponse } from "next/server";
import { getApiUser, unauthorized, tooManyRequests } from "@/lib/supabase/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { normalizeKey } from "@/lib/normalize-key";

const CACHE_TTL_DAYS = 7; // 신간 반영 위해 너무 길게는 안 함

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookieStore).getAll();
        },
        async setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              (await cookieStore).set(name, value, options);
            }
          } catch {
            // ignore
          }
        },
      },
    },
  );
}

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const { success } = rateLimit(`search:${user.id}`, 20);
  if (!success) return tooManyRequests();

  const { query } = await req.json();

  if (!query || typeof query !== "string" || query.length > 200) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const supabase = getSupabase();
  const queryNorm = normalizeKey(query);

  // ═══ 캐시 확인 ═══
  const { data: cached } = await supabase
    .from("aladin_search_cache")
    .select("books, expires_at")
    .eq("query_normalized", queryNorm)
    .single();

  if (cached && new Date(cached.expires_at) > new Date()) {
    console.log("[search-book] 캐시 히트:", query);
    // hit_count 증가 (비동기, 실패해도 무시)
    supabase
      .rpc("increment_aladin_search_hits", { p_query: queryNorm })
      .then(() => {}, () => {});
    return NextResponse.json({ books: cached.books, cached: true });
  }

  try {
    const ttbKey = process.env.ALADIN_TTB_KEY;
    if (!ttbKey) {
      console.error("[search-book] ALADIN_TTB_KEY not set");
      return NextResponse.json({ books: [] }, { status: 500 });
    }

    // 1) ItemSearch로 검색
    // ⚠️ Aladin API는 헤더 인증을 지원하지 않아 URL query 방식 불가피
    // 대신 HTTPS로 전송하여 중간자 공격(MITM) 방지
    const searchUrl =
      `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?` +
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
                `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?` +
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

    // ═══ 캐시 저장 (결과가 있을 때만) ═══
    if (books.length > 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);
      await supabase
        .from("aladin_search_cache")
        .upsert(
          {
            query_normalized: queryNorm,
            books,
            expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "query_normalized" },
        );
      console.log("[search-book] 캐시 저장:", query, `(${books.length}개, ${CACHE_TTL_DAYS}일 유효)`);
    }

    return NextResponse.json({ books });
  } catch (error) {
    console.error("[search-book] error:", error);
    return NextResponse.json({ books: [] }, { status: 500 });
  }
}
