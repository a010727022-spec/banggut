import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppTheme = "dark" | "cream" | "navy" | "sepia" | "blossom";

const VALID_THEMES: AppTheme[] = ["dark", "cream", "navy", "sepia", "blossom"];

interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "cream",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "banggut-theme",
      // 기존 ocean/forest 사용자 마이그레이션
      onRehydrateStorage: () => (state) => {
        if (state && !VALID_THEMES.includes(state.theme as AppTheme)) {
          state.theme = "cream";
        }
      },
    }
  )
);
