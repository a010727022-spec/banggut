import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/supabase/api-auth";

/**
 * 알라딘 종합 베스트셀러 조회.
 * 하루 단위로 캐시 (revalidate = 86400s).
 * 신규 유저의 첫 책 선택을 돕기 위한 엔드포인트.
 */
export const revalidate = 86400; // 24h

interface AladinItem {
  title: string;
  author: string;
  publisher: string;
  pubDate: string;
  cover: string;
  description: string;
  isbn13?: string;
  isbn?: string;
  categoryName?: string;
}

interface BestsellerBook {
  title: string;
  author: string;
  publisher?: string;
  pubDate?: string;
  cover?: string;
  description?: string;
  isbn?: string;
  category?: string;
}

// 방긋 장르 id → 알라딘 CategoryId 매핑
// 참고: 알라딘 카탈로그 메인 CID https://wiki.aladin.co.kr/display/openAPI
const GENRE_TO_ALADIN_CID: Record<string, number> = {
  novel: 1,        // 소설/시/희곡
  essay: 55889,    // 에세이
  humanities: 656, // 인문학
  selfhelp: 336,   // 자기계발
  science: 987,    // 과학
  history: 74,     // 역사/문화
  business: 170,   // 경제경영
  art: 517,        // 예술/대중문화
  // 아래 장르는 CID 매칭 애매 → 0(전체) 폴백
  webnovel: 0,
  fantasy: 0,
  mystery: 0,
  romance: 0,
};

export async function GET(req: Request) {
  // 로그인 유저에게만 노출 (신규 유저 첫 화면에서 호출)
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const ttbKey = process.env.ALADIN_TTB_KEY;
  if (!ttbKey) {
    console.error("[bestsellers] ALADIN_TTB_KEY not set");
    return NextResponse.json({ books: [] }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const genre = searchParams.get("genre");
  const categoryId = genre && genre in GENRE_TO_ALADIN_CID ? GENRE_TO_ALADIN_CID[genre] : 0;

  try {
    const url =
      `http://www.aladin.co.kr/ttb/api/ItemList.aspx?` +
      `ttbkey=${ttbKey}` +
      `&QueryType=Bestseller` +
      `&MaxResults=12` +
      `&start=1` +
      `&SearchTarget=Book` +
      `&CategoryId=${categoryId}` +
      `&output=js` +
      `&Version=20131101`;

    const res = await fetch(url, {
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      console.error("[bestsellers] Aladin API error:", res.status);
      return NextResponse.json({ books: [] }, { status: 502 });
    }

    const data = await res.json();
    const items: AladinItem[] = data.item || [];

    const books: BestsellerBook[] = items.map((book) => {
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
        isbn: book.isbn13 || book.isbn,
        category: book.categoryName,
      };
    });

    return NextResponse.json({ books });
  } catch (error) {
    console.error("[bestsellers] error:", error);
    return NextResponse.json({ books: [] }, { status: 500 });
  }
}
