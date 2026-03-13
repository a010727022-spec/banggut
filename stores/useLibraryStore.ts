import { create } from "zustand";
import type { Book } from "@/lib/types";

interface LibraryState {
  books: Book[];
  viewMode: "grid" | "list";
  isLoading: boolean;
  setBooks: (books: Book[]) => void;
  addBook: (book: Book) => void;
  removeBook: (id: string) => void;
  updateBook: (id: string, updates: Partial<Book>) => void;
  setViewMode: (mode: "grid" | "list") => void;
  setLoading: (loading: boolean) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  books: [],
  viewMode: "grid",
  isLoading: true,
  setBooks: (books) => set({ books, isLoading: false }),
  addBook: (book) => set((s) => ({ books: [book, ...s.books] })),
  removeBook: (id) => set((s) => ({ books: s.books.filter((b) => b.id !== id) })),
  updateBook: (id, updates) =>
    set((s) => ({
      books: s.books.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),
  setViewMode: (viewMode) => set({ viewMode }),
  setLoading: (isLoading) => set({ isLoading }),
}));
