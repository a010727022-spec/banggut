import { format } from "date-fns";

export function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (!set.has(format(d, "yyyy-MM-dd"))) d.setDate(d.getDate() - 1);
  let s = 0;
  while (set.has(format(d, "yyyy-MM-dd"))) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

export function calcTemp(streak: number, dates: string[]): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const set = new Set(dates);
  let r7 = 0;
  for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(d.getDate() - i); if (set.has(format(d, "yyyy-MM-dd"))) r7++; }
  return Math.min(100, Math.max(0, 10 + streak * 4 + r7 * 8));
}

export function getTempSeason(t: number) {
  if (t >= 85) return { name: "수확 독자", color: "#c8a030", bg: "rgba(200,160,48,0.12)" };
  if (t >= 60) return { name: "여름 독자", color: "var(--ac)", bg: "color-mix(in srgb, var(--ac) 12%, transparent)" };
  if (t >= 36) return { name: "봄 독자", color: "#4ade80", bg: "rgba(74,222,128,0.10)" };
  return { name: "겨울 독자", color: "#5b9bd5", bg: "rgba(91,155,213,0.12)" };
}

export function getWeekBars(dates: string[]) {
  const set = new Set(dates);
  const labels = ["월","화","수","목","금","토","일"];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); const off = dow === 0 ? 6 : dow - 1;
  return labels.map((label, i) => {
    const d = new Date(today); d.setDate(d.getDate() - off + i);
    return { label, active: set.has(format(d, "yyyy-MM-dd")), isToday: d.getTime() === today.getTime() };
  });
}

export function upgradeCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace("/cover/", "/cover500/").replace("/cover200/", "/cover500/").replace("/coversum/", "/cover500/").replace("http://", "https://");
}

/**
 * 책 표지 fallback 그라데이션 팔레트.
 * 모든 변형이 테마 토큰(--ac, --sf2, --milestone, --theme-deep 등)을 참조해
 * 사용자가 선택한 테마와 항상 어우러지도록 설계됨. (Gail)
 */
export const COVER_PALETTES: [string, string][] = [
  ["var(--ac2)", "var(--theme-deep)"],   // 악센트 라이트 → 딥
  ["var(--sf3)", "var(--ac)"],           // 뉴트럴 → 악센트
  ["var(--ac)", "var(--theme-deep)"],    // 악센트 → 딥
  ["var(--milestone)", "var(--theme-deep)"], // 골드 마일스톤 → 딥
  ["var(--ac3)", "var(--ac)"],           // 소프트 악센트
  ["var(--sf2)", "var(--sf3)"],          // 순수 뉴트럴 듀오
];
export const coverPalette = (t: string): [string, string] =>
  COVER_PALETTES[(t?.charCodeAt(0) ?? 0) % COVER_PALETTES.length];
