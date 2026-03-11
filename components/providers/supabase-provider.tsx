"use client";

import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { getProfile } from "@/lib/supabase/queries";
import { useEffect, useRef } from "react";

// getProfile에 3초 타임아웃 (Promise.race로 강제)
function getProfileWithTimeout(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  return Promise.race([
    getProfile(supabase, userId).catch((err) => {
      console.error("[Auth] getProfile threw:", err);
      return null;
    }),
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn("[Auth] getProfile timed out after 3s");
        resolve(null);
      }, 3000)
    ),
  ]);
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    console.log("[Auth] SupabaseProvider init started");
    const supabase = createClient();

    // 8초 안에 로딩 안 끝나면 강제로 로딩 해제
    const timeout = setTimeout(() => {
      const { isLoading } = useAuthStore.getState();
      if (isLoading) {
        console.warn("[Auth] timeout — forcing loading end");
        setLoading(false);
      }
    }, 8000);

    const resolveUser = async (
      userId: string,
      email: string | undefined,
      source: string
    ) => {
      console.log(`[Auth] resolveUser from ${source}, userId:`, userId);

      const profile = await getProfileWithTimeout(supabase, userId);
      console.log(
        `[Auth] profile result from ${source}:`,
        profile ? `found (${profile.nickname})` : "null"
      );

      if (profile) {
        setUser(profile);
      } else {
        // 프로필이 없거나 조회 실패 → 세션은 유효하므로 최소한의 유저 정보 사용
        // (AuthGuard가 로그아웃으로 판단하지 않도록)
        console.log("[Auth] Using fallback user from session");
        setUser({
          id: userId,
          nickname: email?.split("@")[0] || "사용자",
          emoji: "🦊",
          created_at: new Date().toISOString(),
        });
      }
    };

    // onAuthStateChange가 모든 인증 상태를 처리
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[Auth] onAuthStateChange:", event, {
          hasSession: !!session,
          userId: session?.user?.id,
        });

        try {
          if (session?.user) {
            await resolveUser(
              session.user.id,
              session.user.email,
              `onAuthStateChange:${event}`
            );
          } else if (event === "INITIAL_SESSION") {
            // 쿠키에서 세션을 못 읽었을 때 → 서버 검증 시도
            console.log("[Auth] No session on INITIAL_SESSION, trying getUser...");
            const { data: { user }, error } = await supabase.auth.getUser();
            console.log("[Auth] getUser fallback:", {
              hasUser: !!user,
              error: error?.message,
            });
            if (user) {
              await resolveUser(user.id, user.email, "getUser-fallback");
            } else {
              setUser(null);
            }
          } else {
            console.log("[Auth] No session, setting user null");
            setUser(null);
          }
        } catch (err) {
          console.error("[Auth] error:", err);
          setUser(null);
        } finally {
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  return <>{children}</>;
}
