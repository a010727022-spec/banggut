import { create } from "zustand";
import { persist } from "zustand/middleware";

/** 방긋 v6 테마 — 산뜻한 민트 / 시크한 프라다 2 가지 */
export type AppTheme = "mint" | "prada";

const VALID_THEMES: AppTheme[] = ["mint", "prada"];

interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "mint",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "banggut-theme",
      // 구 5-테마(dark/cream/navy/sepia/blossom) 사용자 마이그레이션
      // - cream → mint (동일 팔레트)
      // - 그 외(다크 계열/네이비/세피아/블러썸) → 기본 mint 로 초기화
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const raw = state.theme as string;
        if (raw === "cream") {
          state.theme = "mint";
        } else if (!VALID_THEMES.includes(raw as AppTheme)) {
          state.theme = "mint";
        }
      },
    }
  )
);
