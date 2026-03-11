import { create } from "zustand";
import type { Scrap } from "@/lib/types";

interface ScrapState {
  scraps: Scrap[];
  isLoading: boolean;
  setScraps: (scraps: Scrap[]) => void;
  addScrap: (scrap: Scrap) => void;
  removeScrap: (id: string) => void;
  updateScrap: (id: string, updates: Partial<Scrap>) => void;
  setLoading: (loading: boolean) => void;
}

export const useScrapStore = create<ScrapState>((set) => ({
  scraps: [],
  isLoading: true,
  setScraps: (scraps) => set({ scraps, isLoading: false }),
  addScrap: (scrap) => set((s) => ({ scraps: [scrap, ...s.scraps] })),
  removeScrap: (id) =>
    set((s) => ({ scraps: s.scraps.filter((sc) => sc.id !== id) })),
  updateScrap: (id, updates) =>
    set((s) => ({
      scraps: s.scraps.map((sc) => (sc.id === id ? { ...sc, ...updates } : sc)),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}));
