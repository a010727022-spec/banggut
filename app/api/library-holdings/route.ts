import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/supabase/api-auth";

/**
 * 특정 도서관에 이 책(ISBN)이 있는지 + 대출 가능 여부 조회.
 * 도서관 정보나루 "도서 소장 정보" API 사용.
 * https://www.data4library.kr/openApiV/detail
 */
export const revalidate = 300; // 5분 캐시 (대출 상태는 자주 바뀜)

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const key = process.env.DATA4LIBRARY_KEY;
  if (!key) {
    return NextResponse.json({ error: "API key missing" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const isbn13 = searchParams.get("isbn13");
  const libCode = searchParams.get("libCode");

  if (!isbn13 || !libCode) {
    return NextResponse.json({ error: "isbn13 and libCode required" }, { status: 400 });
  }

  try {
    const qs = new URLSearchParams({
      authKey: key,
      format: "json",
      isbn13,
      libCode,
    });
    const url = `https://data4library.kr/api/bookExist?${qs.toString()}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json({ available: false, error: "api error" }, { status: 502 });
    }
    const data = await res.json();
    const result = data?.response?.result;
    // hasBook: "Y" or "N"
    // loanAvailable: "Y" or "N"
    const hasBook = result?.hasBook === "Y";
    const loanAvailable = result?.loanAvailable === "Y";
    return NextResponse.json({
      hasBook,
      loanAvailable,
      status: !hasBook ? "not_owned" : loanAvailable ? "available" : "checked_out",
    });
  } catch (e) {
    console.error("[library-holdings] error:", e);
    return NextResponse.json({ available: false }, { status: 500 });
  }
}
