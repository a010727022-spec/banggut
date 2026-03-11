import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * API 라우트에서 Supabase 인증을 검증하는 헬퍼.
 * cookies()를 사용하여 미들웨어가 갱신한 토큰을 올바르게 읽음.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getApiUser(req: Request): Promise<User | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Edge Runtime에서는 set이 불가할 수 있음 — 무시
          }
        },
      },
    }
  );

  // 1차: getUser()로 검증
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  // 2차: 토큰 만료 시 세션 리프레시 후 재시도
  try {
    const { error } = await supabase.auth.refreshSession();
    if (error) return null;
    const {
      data: { user: refreshedUser },
    } = await supabase.auth.getUser();
    return refreshedUser;
  } catch {
    return null;
  }
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function tooManyRequests() {
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}
