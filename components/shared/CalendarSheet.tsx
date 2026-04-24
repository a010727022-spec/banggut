"use client";

import { useEffect } from "react";
import ReadingCalendar, { type CalEvent } from "./ReadingCalendar";

/* ═══════════════════════════════════════════
   CalendarSheet — 캘린더 바텀시트
   ═══════════════════════════════════════════
   - dim overlay + 하단에서 올라오는 시트
   - ReadingCalendar를 감싸서 풀스크린 뷰 제공
   - Esc / overlay 탭 / 닫기 버튼으로 dismiss
   - body scroll lock
*/

export interface CalendarSheetProps {
  open: boolean;
  onClose: () => void;
  readDates: string[];
  events: CalEvent[];
  streak: number;
  today?: string;
  onEventTap?: (event: CalEvent) => void;
}

export default function CalendarSheet({
  open,
  onClose,
  readDates,
  events,
  streak,
  today,
  onEventTap,
}: CalendarSheetProps) {
  // ESC 닫기 + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="읽기 캘린더"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
      }}
    >
      <style>{`
        @keyframes banggut-sheet-slideup {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes banggut-sheet-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* dim overlay */}
      <button
        aria-label="닫기"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(30,25,18,0.35)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          animation: "banggut-sheet-fadein 180ms ease-out",
        }}
      />

      {/* sheet */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--bg)",
          borderRadius: "20px 20px 0 0",
          padding: "8px 0 max(24px, env(safe-area-inset-bottom))",
          boxShadow: "0 -12px 32px rgba(30,25,18,0.2)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          animation: "banggut-sheet-slideup 240ms cubic-bezier(0.2, 0.9, 0.2, 1)",
        }}
      >
        {/* 핸들 */}
        <div
          style={{
            width: 36,
            height: 4,
            background: "var(--bd2)",
            borderRadius: 100,
            margin: "0 auto 10px",
            flexShrink: 0,
          }}
        />

        {/* 헤더 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 20px 14px",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-playful, 'Gaegu', cursive)",
                fontSize: 18,
                fontWeight: 700,
                color: "var(--tp)",
              }}
            >
              읽기 캘린더
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--tm)",
                marginTop: 2,
              }}
            >
              이 달의 리듬과 앞으로의 일정
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--sf)",
              border: "0.5px solid var(--bd)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ts)",
              fontSize: 14,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* 본문 (캘린더 + 이벤트) */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "0 0 10px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ margin: "0 0 8px" }}>
            <ReadingCalendar
              today={today}
              readDates={readDates}
              events={events}
              streak={streak}
              onEventTap={(e) => {
                onEventTap?.(e);
                onClose();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
