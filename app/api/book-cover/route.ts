import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  const author = searchParams.get("author");

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  try {
    const query = encodeURIComponent(`${title}${author ? ` ${author}` : ""}`);
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1&langRestrict=ko`,
      { next: { revalidate: 86400 } } // 24시간 캐시
    );

    if (!res.ok) {
      return NextResponse.json({ cover_url: null });
    }

    const data = await res.json();
    const item = data.items?.[0];

    if (!item) {
      return NextResponse.json({ cover_url: null });
    }

    const info = item.volumeInfo || {};
    // 고해상도 썸네일 우선
    const cover_url =
      info.imageLinks?.thumbnail?.replace("zoom=1", "zoom=2")?.replace("http://", "https://") ||
      info.imageLinks?.smallThumbnail?.replace("http://", "https://") ||
      null;

    return NextResponse.json({
      cover_url,
      publisher: info.publisher || null,
      published_date: info.publishedDate || null,
      page_count: info.pageCount || null,
      description: info.description?.slice(0, 200) || null,
    });
  } catch {
    return NextResponse.json({ cover_url: null });
  }
}
