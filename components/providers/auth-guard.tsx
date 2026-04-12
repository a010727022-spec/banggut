"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import { useEffect, useRef } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const redirecting = useRef(false);

  useEffect(() => {
    if (!isLoading && !user && !redirecting.current) {
      redirecting.current = true;
      window.location.href = "/onboarding";
    }
  }, [isLoading, user]);

  useEffect(() => {
    if (user) redirecting.current = false;
  }, [user]);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", transition: "background 0.4s" }}>
        {/* 히어로 스켈레톤 */}
        <div style={{ height: 180, background: "var(--sf)", transition: "background 0.4s" }} className="skeleton" />

        <div style={{ padding: "0 20px" }}>
          {/* 프로필 스켈레톤 */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: -30, marginBottom: 16 }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", flexShrink: 0 }} className="skeleton" />
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ width: 100, height: 18, borderRadius: 6, marginBottom: 8 }} className="skeleton" />
              <div style={{ width: 80, height: 12, borderRadius: 6, marginBottom: 10 }} className="skeleton" />
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ width: 50, height: 14, borderRadius: 6 }} className="skeleton" />
                <div style={{ width: 50, height: 14, borderRadius: 6 }} className="skeleton" />
                <div style={{ width: 50, height: 14, borderRadius: 6 }} className="skeleton" />
              </div>
            </div>
          </div>

          {/* 버튼 스켈레톤 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 38, borderRadius: 10 }} className="skeleton" />
            <div style={{ width: 40, height: 38, borderRadius: 10 }} className="skeleton" />
            <div style={{ width: 40, height: 38, borderRadius: 10 }} className="skeleton" />
          </div>

          {/* 체온 스켈레톤 */}
          <div style={{ height: 90, borderRadius: 14, marginBottom: 16 }} className="skeleton" />

          {/* 탭 스켈레톤 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 64, height: 30, borderRadius: 100 }} className="skeleton" />
            <div style={{ width: 64, height: 30, borderRadius: 100 }} className="skeleton" />
            <div style={{ width: 48, height: 30, borderRadius: 100 }} className="skeleton" />
          </div>

          {/* 카드 스켈레톤 */}
          <div style={{ height: 140, borderRadius: 16, marginBottom: 12 }} className="skeleton" />
          <div style={{ height: 140, borderRadius: 16 }} className="skeleton" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <p style={{ fontSize: 13, color: "var(--tm)" }}>로그인 페이지로 이동 중...</p>
      </div>
    );
  }

  return <>{children}</>;
}
