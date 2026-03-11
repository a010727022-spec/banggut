"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const router = useRouter();
  const redirecting = useRef(false);

  useEffect(() => {
    // 로딩 끝났는데 유저가 없으면 → 온보딩으로 (1회만 시도)
    if (!isLoading && !user && !redirecting.current) {
      redirecting.current = true;
      // window.location을 사용해 full navigation → 미들웨어가 제대로 실행됨
      window.location.href = "/onboarding";
    }
  }, [isLoading, user, router]);

  // 유저가 복구되면 리다이렉트 취소
  useEffect(() => {
    if (user) {
      redirecting.current = false;
    }
  }, [user]);

  // 로딩 중
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <div className="text-center">
          <div className="text-3xl mb-3">📖</div>
          <p className="text-warmgray text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 유저 없으면 리다이렉트 대기 중 (빈 화면 방지)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <p className="text-warmgray text-sm">로그인 페이지로 이동 중...</p>
      </div>
    );
  }

  return <>{children}</>;
}
