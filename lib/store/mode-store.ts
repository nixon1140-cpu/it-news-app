import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppMode = "individual" | "enterprise";

interface ModeState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set, get) => ({
      mode: "individual",
      setMode: (mode) => set({ mode }),
      toggleMode: () =>
        set({ mode: get().mode === "individual" ? "enterprise" : "individual" }),
    }),
    {
      name: "it-news-app-mode",
    }
  )
);
