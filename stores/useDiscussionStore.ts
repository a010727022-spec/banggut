import { create } from "zustand";
import type { Message, Underline } from "@/lib/types";

interface DiscussionState {
  messages: Message[];
  underlines: Underline[];
  isStreaming: boolean;
  streamContent: string;
  bookContext: string;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setUnderlines: (underlines: Underline[]) => void;
  addUnderline: (underline: Underline) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamContent: (content: string) => void;
  appendStreamContent: (chunk: string) => void;
  setBookContext: (context: string) => void;
  reset: () => void;
}

export const useDiscussionStore = create<DiscussionState>((set) => ({
  messages: [],
  underlines: [],
  isStreaming: false,
  streamContent: "",
  bookContext: "",
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setUnderlines: (underlines) => set({ underlines }),
  addUnderline: (underline) =>
    set((s) => ({ underlines: [...s.underlines, underline] })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setStreamContent: (streamContent) => set({ streamContent }),
  appendStreamContent: (chunk) =>
    set((s) => ({ streamContent: s.streamContent + chunk })),
  setBookContext: (bookContext) => set({ bookContext }),
  reset: () =>
    set({
      messages: [],
      underlines: [],
      isStreaming: false,
      streamContent: "",
      bookContext: "",
    }),
}));
