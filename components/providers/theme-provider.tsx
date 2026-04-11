"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/useThemeStore";

// 자식 없이 단독 사용 — html[data-theme] 속성 주입만 담당
export function ThemeProvider() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return null;
}
