import { create } from "zustand";
import { persist } from "zustand/middleware";

// 두 테마:
//  - "hero"     : 이어 읽기 HERO (민트 그라데이션 대형 카드 + 세그먼트 탭)
//  - "calendar" : 캘린더 First (캘린더 위젯 + 컴팩트 이어 읽기 + 친구 피드)
export type HomeLayout = "hero" | "calendar";

const VALID_LAYOUTS: HomeLayout[] = ["hero", "calendar"];

interface HomeLayoutState {
  layout: HomeLayout;
  isHydrated: boolean;
  setLayout: (layout: HomeLayout) => void;
  setHydrated: () => void;
}

export const useHomeLayoutStore = create<HomeLayoutState>()(
  persist(
    (set) => ({
      layout: "calendar",
      isHydrated: false,
      setLayout: (layout) => set({ layout }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: "banggut-home-layout",
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (!VALID_LAYOUTS.includes(state.layout as HomeLayout)) {
            state.layout = "calendar";
          }
          state.isHydrated = true;
        }
      },
    }
  )
);
