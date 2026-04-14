import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (e) {
    console.error("[middleware] auth check failed:", e);
    // Let request through — auth-guard will handle it
  }

  const isOnboarding = request.nextUrl.pathname.startsWith("/onboarding");
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth");
  const isApi = request.nextUrl.pathname.startsWith("/api");

  // 미로그인 → 온보딩으로
  if (!user && !isOnboarding && !isAuthCallback && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  // 로그인 상태에서 온보딩 접근 → 홈으로
  // (profiles DB 쿼리 제거 — SupabaseProvider에서 처리)
  if (user && isOnboarding) {
    // 쿠키로 프로필 완료 여부 빠르게 확인
    const hasProfile = request.cookies.get("banggut-has-profile")?.value === "1";
    if (hasProfile) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
