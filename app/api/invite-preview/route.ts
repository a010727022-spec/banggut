import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 인비테이션 페이지용 공개 프리뷰 API.
 * 로그인 여부와 상관없이 책 + 초대자 정보를 반환.
 * Service Role Key를 사용해 RLS 우회 (읽기 전용, 민감정보 제외)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId");
  const fromUserId = searchParams.get("from");

  if (!bookId) {
    return NextResponse.json({ error: "bookId required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 책 정보 (민감 필드 제외)
  const { data: book } = await admin
    .from("books")
    .select("id, title, author, cover_url, genre, reading_status, progress_percent, rating, total_pages")
    .eq("id", bookId)
    .maybeSingle();

  if (!book) {
    return NextResponse.json({ error: "book not found" }, { status: 404 });
  }

  // 초대자 프로필 (닉네임·이모지만)
  let inviter = null;
  if (fromUserId) {
    const { data } = await admin
      .from("profiles")
      .select("nickname, emoji")
      .eq("id", fromUserId)
      .maybeSingle();
    inviter = data;
  }

  return NextResponse.json({ book, inviter });
}
