"use client";

import { Lock } from "lucide-react";

/**
 * LockedTabCard — 책을 읽는 중일 때 AI 토론/서평 탭에 표시되는 잠김 플레이스홀더.
 *
 * v8 mockup의 "완독 후 해금" 철학을 실제 탭 콘텐츠에 적용해요.
 *
 * 해금 조건: `book.reading_status === "finished"` 되는 순간 자물쇠 해제,
 * 해당 탭이 정상 콘텐츠로 전환돼요 (페이지 단에서 분기).
 */
export default function LockedTabCard({
  kind,
}: {
  kind: "discussion" | "review";
}) {
  const copy =
    kind === "discussion"
      ? {
          title: "방긋이랑 얘기해요",
          body:
            "책을 다 읽고 만나요. 감상을 서두르지 않고,\n책과 나 둘만의 시간을 먼저 쌓아볼게요.",
          hint: "완독하면 방긋이가 오늘 읽은 맥락으로 대화를 준비해드려요",
        }
      : {
          title: "서평 쓰기",
          body:
            "책을 다 읽은 뒤에 열려요. 지금은 문장만 모아 두고,\n마무리 감상은 완독 후에 남겨주세요.",
          hint: "읽는 중에는 문장 긋기로 인상적인 대목을 남겨두세요",
        };

  return (
    <div
      style={{
        margin: "8px 0 4px",
        padding: "28px 22px",
        background: "var(--sf)",
        border: "0.5px dashed var(--bd2)",
        borderRadius: 16,
        textAlign: "center",
        color: "var(--tm)",
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--sf2)",
          border: "0.5px solid var(--bd)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Lock size={18} color="var(--tm)" strokeWidth={2.2} />
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "var(--tp)",
          letterSpacing: "-0.3px",
          marginBottom: 6,
        }}
      >
        {copy.title}
      </div>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          color: "var(--tm)",
          whiteSpace: "pre-line",
          marginBottom: 10,
        }}
      >
        {copy.body}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--tm)",
          opacity: 0.7,
          lineHeight: 1.5,
          letterSpacing: "-0.1px",
        }}
      >
        {copy.hint}
      </div>
    </div>
  );
}
