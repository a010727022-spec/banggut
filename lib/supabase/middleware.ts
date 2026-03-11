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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOnboarding = request.nextUrl.pathname.startsWith("/onboarding");
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth");
  const isApi = request.nextUrl.pathname.startsWith("/api");

  // 미로그인 → 온보딩으로
  if (!user && !isOnboarding && !isAuthCallback && !isApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  if (user) {
    // 프로필 존재 여부 확인
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (isOnboarding && profile) {
      // 프로필 있는데 온보딩에 있으면 → 홈으로
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (!isOnboarding && !isAuthCallback && !isApi && !profile) {
      // 프로필 없는데 앱을 쓰려고 하면 → 온보딩 프로필 설정으로
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.searchParams.set("step", "profile");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
