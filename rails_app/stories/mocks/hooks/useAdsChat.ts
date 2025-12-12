import { useState, useCallback } from "react";
import type { AdsGraphState } from "@shared";

type Message = {
  role: "assistant" | "user";
  blocks: { id: string; type: string; text?: string }[];
};

type AdsSnapshot = {
  messages: Message[];
  state: Partial<AdsGraphState>;
  status: "idle" | "streaming" | "error";
  isLoading: boolean;
  isLoadingHistory: boolean;
  threadId?: string;
  sendMessage: (message: string) => void;
  updateState: (updates: Partial<AdsGraphState>) => void;
  setState: (state: Partial<AdsGraphState>) => void;
  stop: () => void;
};

declare global {
  interface Window {
    __STORYBOOK_MOCK_ADS_CHAT__?: Partial<AdsSnapshot>;
  }
}

function getMockState(): AdsSnapshot {
  const mockOverrides = typeof window !== "undefined" ? window.__STORYBOOK_MOCK_ADS_CHAT__ : undefined;

  return {
    messages: [],
    state: {},
    status: "idle",
    isLoading: false,
    isLoadingHistory: false,
    threadId: "storybook-thread",
    sendMessage: (msg) => console.log("[Storybook Mock] sendMessage:", msg),
    updateState: (updates) => console.log("[Storybook Mock] updateState:", updates),
    setState: (state) => console.log("[Storybook Mock] setState:", state),
    stop: () => console.log("[Storybook Mock] stop"),
    ...mockOverrides,
  };
}

export function useAdsChat<TSelected = AdsSnapshot>(
  selector?: (snapshot: AdsSnapshot) => TSelected
): TSelected {
  const snapshot = getMockState();

  if (selector) {
    return selector(snapshot);
  }
  return snapshot as TSelected;
}

export function useAdsChatMessages() {
  return useAdsChat((s) => s.messages);
}

export function useAdsChatState<K extends keyof AdsGraphState>(key: K) {
  return useAdsChat((s) => s.state[key]);
}

export function useAdsChatFullState() {
  return useAdsChat((s) => s.state);
}

export function useAdsChatStatus() {
  return useAdsChat((s) => s.status);
}

export function useAdsChatIsLoading() {
  return useAdsChat((s) => s.isLoading);
}

export function useAdsChatIsLoadingHistory() {
  return useAdsChat((s) => s.isLoadingHistory);
}

export function useAdsChatActions() {
  return useAdsChat((s) => ({
    sendMessage: s.sendMessage,
    updateState: s.updateState,
    setState: s.setState,
    stop: s.stop,
  }));
}

export function useAdsChatThreadId() {
  return useAdsChat((s) => s.threadId);
}
