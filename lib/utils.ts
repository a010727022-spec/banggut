import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 반납일 D-day 계산 */
export function getDdayInfo(dueDate: string | null): {
  diff: number;
  text: string;
  color: string;
} | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { diff, text: "연체!", color: "#DC3545" };
  if (diff === 0) return { diff, text: "오늘 반납!", color: "#DC3545" };
  if (diff <= 2) return { diff, text: `D-${diff}`, color: "#B86B4A" };
  if (diff <= 5) return { diff, text: `D-${diff}`, color: "#C4A35A" };
  return null;
}
