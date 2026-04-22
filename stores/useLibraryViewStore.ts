import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 서재 페이지 뷰 선택 — mockup-library-v1.html 기준 A/B/C.
 * A · 책꽂이 은유: 책등 가로 스크롤 + 쉘프 나무 바
 * B · 큐레이터 보드: 이달의 한 문장 + 표지 2-col 그리드
 * C · 4 스택: 2×2 무더기 카운트 카드 + 주간 하이라이트
 */
export type LibraryView = "A" | "B" | "C";

interface LibraryViewState {
  view: LibraryView;
  exhibit: boolean; // 전시 토글 (공개/비공개 — UI 힌트만, 기능 미연결)
  setView: (view: LibraryView) => void;
  setExhibit: (on: boolean) => void;
}

export const useLibraryViewStore = create<LibraryViewState>()(
  persist(
    (set) => ({
      view: "A",
      exhibit: true,
      setView: (view) => set({ view }),
      setExhibit: (exhibit) => set({ exhibit }),
    }),
    { name: "banggut-library-view" }
  )
);
