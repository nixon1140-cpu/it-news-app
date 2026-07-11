import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AiServiceId = "chatgpt" | "gemini" | "claude";

export interface AiServiceDefinition {
  id: AiServiceId;
  label: string;
  url: string;
}

// 深掘り分析のハンドオフ先AIサービス定義。ここに1箇所に集約し、
// サービスの追加・削除時の変更箇所を最小化する（switch文での分岐は行わない）。
export const AI_SERVICES: AiServiceDefinition[] = [
  { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "gemini", label: "Gemini", url: "https://gemini.google.com/" },
  { id: "claude", label: "Claude", url: "https://claude.ai/new" },
];

interface HandoffState {
  service: AiServiceId;
  setService: (service: AiServiceId) => void;
}

export const useHandoffStore = create<HandoffState>()(
  persist(
    (set) => ({
      service: "gemini",
      setService: (service) => set({ service }),
    }),
    {
      name: "it-news-app-handoff-service",
    }
  )
);
