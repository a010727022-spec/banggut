"use client";

import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { getProfile } from "@/lib/supabase/queries";
import { useEffect } from "react";

function makeFallbackUser(userId: string, email?: string | null) {
  return {
    id: userId,
    nickname: email?.split("@")[0] || "사용자",
    emoji: "hemingway" as const,
    created_at: new Date().toISOString(),
  };
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    const supabase = createClient();
    let resolved = false;

    // 3초 안전장치 (5초 → 3초로 단축)
    const safetyTimeout = setTimeout(() => {
      const { isLoading } = useAuthStore.getState();
      if (isLoading) {
        console.warn("[Auth] safety timeout — forcing loading=false");
        setLoading(false);
      }
    }, 3000);

    const resolveUser = async (userId: string, email: string | undefined) => {
      if (resolved) return;
      resolved = true;

      try {
        // getProfile에 1.5초 타임아웃 (3초 → 1.5초로 단축)
        const profile = await Promise.race([
          getProfile(supabase, userId),
          new Promise<null>((r) => setTimeout(() => r(null), 1500)),
        ]);

        const user = profile || makeFallbackUser(userId, email);
        setUser(user);

        // 미들웨어용 프로필 쿠키 세팅
        if (profile) {
          document.cookie = "banggut-has-profile=1;path=/;max-age=31536000;SameSite=Lax";
        }
      } catch {
        setUser(makeFallbackUser(userId, email));
      } finally {
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (session?.user) {
            await resolveUser(session.user.id, session.user.email);
          } else if (event === "INITIAL_SESSION") {
            // onAuthStateChange가 세션을 못 주면 getUser() 호출
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await resolveUser(user.id, user.email);
            } else {
              setUser(null);
              setLoading(false);
            }
          } else if (event === "SIGNED_OUT") {
            resolved = false;
            setUser(null);
            setLoading(false);
            // 프로필 쿠키 제거
            document.cookie = "banggut-has-profile=;path=/;max-age=0";
          }
        } catch {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  return <>{children}</>;
}
