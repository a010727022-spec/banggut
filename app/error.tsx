"use client";

import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px",
        backgroundColor: "var(--bg)",
        textAlign: "center",
      }}
    >
      <AlertTriangle
        style={{ width: 48, height: 48, color: "var(--ac)", marginBottom: 16 }}
      />
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--tp)",
          marginBottom: 8,
          fontFamily: "var(--sf)",
        }}
      >
        문제가 발생했어요
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--ts)",
          marginBottom: 24,
          fontFamily: "var(--sf)",
        }}
      >
        잠시 후 다시 시도해주세요
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--bg)",
          backgroundColor: "var(--ac)",
          border: "1px solid var(--bd)",
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: "var(--sf)",
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
