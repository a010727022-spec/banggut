import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/supabase/api-auth";

/**
 * 도서관 정보나루 API를 이용한 도서관 검색.
 * 유저가 자주 가는 도서관을 설정할 때 사용.
 * https://www.data4library.kr/openApiV/libSrch
 */
export const revalidate = 3600; // 1h 캐시

interface LibraryItem {
  libCode: string;
  libName: string;
  address: string;
  tel: string;
  homepage?: string;
}

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();

  const key = process.env.DATA4LIBRARY_KEY;
  if (!key) {
    console.error("[library-search] DATA4LIBRARY_KEY not set");
    return NextResponse.json({ libraries: [], error: "api_key_missing", message: "도서관 정보나루 API 키가 설정되지 않았어요. .env.local에 DATA4LIBRARY_KEY 추가 후 서버 재시작." });
  }

  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") || ""; // 지역코드 (예: "11" 서울)
  const query = searchParams.get("q") || "";      // 도서관 이름 검색
  const dtl_region = searchParams.get("dtl_region") || "";

  const qs = new URLSearchParams({ authKey: key, format: "json", pageSize: "20" });
  if (region) qs.set("region", region);
  if (dtl_region) qs.set("dtl_region", dtl_region);
  if (query) qs.set("libName", query);

  try {
    const url = `https://data4library.kr/api/libSrch?${qs.toString()}`;
    // 참고: /extends/libSrch 도 동일한 기능이나 API 활성화 필요
    // https://www.data4library.kr/openApiV#openAPI_pub_0004
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ libraries: [] }, { status: 502 });
    }
    const data = await res.json();
    // API 승인 대기/에러 응답 처리
    if (data?.response?.error) {
      const errMsg = data.response.error;
      if (errMsg.includes("활성화")) {
        return NextResponse.json({
          libraries: [],
          error: "api_not_approved",
          message: "도서관 정보나루 API 승인 대기 중이에요. 보통 영업일 기준 1~2일 걸려요.",
        });
      }
      return NextResponse.json({
        libraries: [],
        error: "api_error",
        message: errMsg,
      });
    }
    const items = data?.response?.libs || [];
    const libraries: LibraryItem[] = items
      .map((w: { lib?: Record<string, string> }) => w.lib)
      .filter(Boolean)
      .map((l: Record<string, string>) => ({
        libCode: l.libCode,
        libName: l.libName,
        address: l.address,
        tel: l.tel,
        homepage: l.homepage,
      }));
    return NextResponse.json({ libraries });
  } catch (e) {
    console.error("[library-search] error:", e);
    return NextResponse.json({ libraries: [] }, { status: 500 });
  }
}
