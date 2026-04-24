"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, X, Sparkles } from "lucide-react";

/* ═══════════════════════════════════════════
   새 쉘프 만들기 (/library/shelves/new)
   ═══════════════════════════════════════════
   MVP 플레이스홀더 — 사용자 정의 쉘프 스키마가 추가되면
   name/reason 입력 + 책 선택 UI로 확장할 예정.
*/

export default function NewShelfPage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        paddingBottom: 40,
        transition: "background var(--duration-slow) var(--easing-default)",
      }}
    >
      {/* 모달 헤더 */}
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "0.5px solid var(--bd)",
          position: "sticky",
          top: 0,
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => router.back()}
          type="button"
          aria-label="뒤로 가기"
          style={{
            width: 40,
            height: 40,
            minWidth: 40,
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--tp)",
          }}
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <div
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: 700,
            color: "var(--tp)",
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          새 쉘프
        </div>
        <button
          onClick={() => router.back()}
          type="button"
          aria-label="닫기"
          style={{
            width: 40,
            height: 40,
            minWidth: 40,
            borderRadius: "50%",
            background: "var(--sf)",
            border: "0.5px solid var(--bd)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--ts)",
          }}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      <div style={{ padding: "40px 20px", maxWidth: 512, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--ac) 14%, var(--sf))",
              border: "1px solid color-mix(in srgb, var(--ac) 18%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ac)",
            }}
          >
            <Sparkles size={28} strokeWidth={2} />
          </div>
        </div>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--tp)",
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
            marginBottom: 10,
          }}
        >
          곧 직접 쉘프를
          <br />
          만들 수 있어요
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--ts)",
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          이름과 한 줄 이유를 붙여
          <br />
          좋아하는 책들을 모은 쉘프를 만들 수 있어요.
          <br />
          지금은 기본 쉘프(완독 · 읽는 중 · 위시리스트)와
          <br />
          장르 자동 쉘프가 표시돼요.
        </p>

        <button
          onClick={() => router.back()}
          type="button"
          style={{
            width: "100%",
            maxWidth: 280,
            padding: 14,
            borderRadius: 14,
            background: "var(--ac)",
            color: "var(--acc)",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            minHeight: 48,
          }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
