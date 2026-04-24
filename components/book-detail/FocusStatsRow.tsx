"use client";

/**
 * FocusStatsRow — v5의 3개 스티커를 하나의 카드 안 hairline 행으로 병합한 버전.
 *
 * 디자인 (v6 refined):
 * - 단일 카드 `var(--sf)` + `var(--bd)` 보더
 * - 행은 dashed 1px hairline으로 구분 (첫 행 제외)
 * - 라벨: Pretendard 12.5px weight 600, `var(--tm)`
 * - 값: Fraunces 18px weight 700, tabular-nums
 * - tone별 컬러:
 *     default → var(--tp) — 평범한 숫자
 *     primary → var(--ac) — 이번 주 같이 brand-highlight
 *     muted   → var(--ts) — 전체 누적 (덜 주목)
 *
 * 주의: Fraunces는 `font-feature-settings`로 자동 로드되지 않으므로
 *       app/layout.tsx 또는 page.tsx에서 import 되어 있어야 해요.
 *       현재 DESIGN.md에 따르면 Fraunces가 이미 로드된 상태.
 */

export type StatsTone = "default" | "primary" | "muted";

export interface StatsRowItem {
  label: string;
  value: string | number;
  unit?: string;
  tone?: StatsTone;
}

interface FocusStatsRowProps {
  rows: StatsRowItem[];
}

const TONE_COLOR: Record<StatsTone, string> = {
  default: "var(--tp)",
  primary: "var(--ac)",
  muted: "var(--ts)",
};

export default function FocusStatsRow({ rows }: FocusStatsRowProps) {
  return (
    <div
      style={{
        background: "var(--sf)",
        border: "0.5px solid var(--bd)",
        borderRadius: 14,
        overflow: "hidden",
        margin: "0 2px",
      }}
    >
      {rows.map((row, i) => {
        const color = TONE_COLOR[row.tone ?? "default"];
        return (
          <div
            key={`${row.label}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderTop: i > 0 ? "1px dashed var(--bd)" : "none",
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                color: "var(--tm)",
                fontWeight: 600,
                letterSpacing: "0.01em",
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                fontFamily:
                  "'Fraunces', Georgia, 'Times New Roman', serif",
                fontWeight: 700,
                fontSize: 18,
                color,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.01em",
              }}
            >
              {row.value}
              {row.unit && (
                <span
                  style={{
                    fontFamily:
                      "'Pretendard Variable', Pretendard, sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--tm)",
                    marginLeft: 3,
                  }}
                >
                  {row.unit}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
