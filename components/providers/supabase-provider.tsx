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

    // 5초 안전장치 — 어떤 이유로든 로딩이 안 끝나면 강제 해제
    const safetyTimeout = setTimeout(() => {
      const { isLoading } = useAuthStore.getState();
      if (isLoading) {
        console.warn("[Auth] safety timeout — forcing loading=false");
        setLoading(false);
      }
    }, 5000);

    const resolveUser = async (userId: string, email: string | undefined) => {
      if (resolved) return;
      resolved = true;

      try {
        // getProfile에 3초 타임아웃
        const profile = await Promise.race([
          getProfile(supabase, userId),
          new Promise<null>((r) => setTimeout(() => r(null), 3000)),
        ]);

        setUser(profile || makeFallbackUser(userId, email));
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
