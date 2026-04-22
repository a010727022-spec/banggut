import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 서재 페이지 뷰 선택 — mockup-library-v1.html 기준 A/B/C.
 * A · 책꽂이 은유: 책등 가로 스크롤 + 쉘프 나무 바
 * B · 큐레이터 보드: 이달의 한 문장 + 표지 2-col 그리드
 * C · 4 스택: 2×2 무더기 카운트 카드 + 주간 하이라이트
 */
export type LibraryView = "A" | "B" | "C";

/**
 * 책 진열 모드 — LibraryViewA 내부의 쉘프(완독·기본 3쉘프 등)에서
 *   "spine" · 옆면: 책등 세로로 나열 (기본)
 *   "cover" · 정면: 표지를 가로로 나열
 */
export type ShelfMode = "spine" | "cover";

/**
 * 서재 탭 (뷰 A 전용) — 내장 3탭 + 사용자 큐레이션 쉘프 id (UUID 문자열).
 *   reading · 읽는 중 / done · 완독 / wish · 위시리스트
 *   그 외 문자열 = 사용자가 만든 커스텀 쉘프 id
 *   * '이어 읽기' 는 홈 HERO 로 승격, 서재는 읽는 중 탭을 유지해 기록 중심 페이지가 돼요.
 */
export const BUILT_IN_TABS = ["reading", "done", "wish"] as const;
export type BuiltInTab = (typeof BUILT_IN_TABS)[number];
export type LibraryTab = BuiltInTab | string;

/** 완독 탭 안의 기간 필터 — 올해만 볼지, 전체 기록을 볼지 */
export type DoneYearFilter = "year" | "all";

/**
 * 사용자 큐레이션 쉘프 (로컬스토리지 기반 MVP).
 *   추후 Supabase 스키마가 생기면 마이그레이션 예정.
 */
export type CuratedShelf = {
  id: string;
  name: string;
  bookIds: string[];
  /** ISO 문자열 — 생성 순으로 정렬하기 위해 저장 */
  createdAt: string;
};

interface LibraryViewState {
  view: LibraryView;
  shelfMode: ShelfMode;
  tab: LibraryTab;
  doneYearFilter: DoneYearFilter;
  exhibit: boolean; // 전시 토글 (공개/비공개 — UI 힌트만, 기능 미연결)
  customShelves: CuratedShelf[];
  setView: (view: LibraryView) => void;
  setShelfMode: (mode: ShelfMode) => void;
  setTab: (tab: LibraryTab) => void;
  setDoneYearFilter: (f: DoneYearFilter) => void;
  setExhibit: (on: boolean) => void;
  // ─── 큐레이션 쉘프 CRUD ───
  createCustomShelf: (name: string) => string; // 새 쉘프 id 반환
  renameCustomShelf: (id: string, name: string) => void;
  deleteCustomShelf: (id: string) => void;
  toggleBookInCustomShelf: (id: string, bookId: string) => void;
  setCustomShelfBooks: (id: string, bookIds: string[]) => void;
}

/** 브라우저/SSR 안전한 id 생성 — crypto 없을 때 폴백 */
function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // 폴백: 시간 + 랜덤 bits
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useLibraryViewStore = create<LibraryViewState>()(
  persist(
    (set) => ({
      view: "A",
      // 기본은 표지(정면) — 책등 모드는 토글로 언제든 전환 가능.
      shelfMode: "cover",
      // 탭 기본 = 읽는 중 (서재 진입 시 가장 액티브한 책부터)
      tab: "reading",
      // 완독 기본 = 올해 (최근 성취감이 먼저 보여야 해요)
      doneYearFilter: "year",
      exhibit: true,
      customShelves: [],
      setView: (view) => set({ view }),
      setShelfMode: (shelfMode) => set({ shelfMode }),
      setTab: (tab) => set({ tab }),
      setDoneYearFilter: (doneYearFilter) => set({ doneYearFilter }),
      setExhibit: (exhibit) => set({ exhibit }),

      createCustomShelf: (name) => {
        const id = genId();
        set((s) => ({
          customShelves: [
            ...s.customShelves,
            { id, name: name.trim() || "새 쉘프", bookIds: [], createdAt: new Date().toISOString() },
          ],
        }));
        return id;
      },
      renameCustomShelf: (id, name) =>
        set((s) => ({
          customShelves: s.customShelves.map((sh) =>
            sh.id === id ? { ...sh, name: name.trim() || sh.name } : sh
          ),
        })),
      deleteCustomShelf: (id) =>
        set((s) => {
          const next = s.customShelves.filter((sh) => sh.id !== id);
          // 삭제한 쉘프가 현재 탭이면 '읽는 중'으로 복귀
          const fallbackTab = s.tab === id ? "reading" : s.tab;
          return { customShelves: next, tab: fallbackTab };
        }),
      toggleBookInCustomShelf: (id, bookId) =>
        set((s) => ({
          customShelves: s.customShelves.map((sh) => {
            if (sh.id !== id) return sh;
            const has = sh.bookIds.includes(bookId);
            return {
              ...sh,
              bookIds: has
                ? sh.bookIds.filter((b) => b !== bookId)
                : [...sh.bookIds, bookId],
            };
          }),
        })),
      setCustomShelfBooks: (id, bookIds) =>
        set((s) => ({
          customShelves: s.customShelves.map((sh) =>
            sh.id === id ? { ...sh, bookIds: [...bookIds] } : sh
          ),
        })),
    }),
    {
      name: "banggut-library-view",
      // v2: shelfMode 기본값 spine → cover
      // v3: tab/doneYearFilter 추가 (홈에서 서재로 4탭 이관)
      // v4: scrap 탭 제거 + customShelves 추가 (사용자 큐레이션)
      // v5: reading 탭 제거 — 상단 '이어 읽기 HERO' 로 승격, 기본 탭 done 으로 이관 (폐기)
      // v6: reading 탭 복구 — 이어 읽기는 홈 HERO 로 이관. 서재는 기록/큐레이션/통계 중심.
      version: 6,
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Partial<LibraryViewState> & {
          tab?: string;
        };
        if (version < 2) {
          return {
            ...state,
            shelfMode: "cover",
            tab: "done",
            doneYearFilter: "year",
            customShelves: [],
          } as LibraryViewState;
        }
        if (version < 3) {
          return {
            ...state,
            tab: "done",
            doneYearFilter: "year",
            customShelves: [],
          } as LibraryViewState;
        }
        if (version < 4) {
          // scrap 탭에 머물러 있던 사용자는 done 으로 복귀
          const nextTab =
            state.tab === "scrap" || state.tab == null ? "done" : state.tab;
          return {
            ...state,
            tab: nextTab,
            customShelves: [],
          } as LibraryViewState;
        }
        if (version < 5) {
          // v5 시점에 reading → done 이관했던 로직. v6 에서 reading 이 복구됐지만
          // v5 migrate 를 통과해서 done 에 머물던 사용자는 그대로 유지해요 (의도 존중).
          const nextTab =
            state.tab === "reading" || state.tab == null ? "done" : state.tab;
          return { ...state, tab: nextTab } as LibraryViewState;
        }
        if (version < 6) {
          // v6 구조는 기본값만 달라졌으니 상태는 그대로. tab 이 비어 있으면 reading 으로.
          const nextTab = state.tab == null ? "reading" : state.tab;
          return { ...state, tab: nextTab } as LibraryViewState;
        }
        return state as LibraryViewState;
      },
    }
  )
);
