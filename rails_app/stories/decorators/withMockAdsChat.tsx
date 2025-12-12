import { useEffect } from "react";
import type { Decorator } from "@storybook/react-vite";
import type { AdsGraphState } from "@shared";

type Message = {
  role: "assistant" | "user";
  blocks: { id: string; type: string; text?: string }[];
};

export type MockAdsChatState = {
  messages?: Message[];
  state?: Partial<AdsGraphState>;
  status?: "idle" | "streaming" | "error";
  isLoading?: boolean;
  isLoadingHistory?: boolean;
  threadId?: string;
};

export const sampleMessages: Message[] = [
  {
    role: "assistant",
    blocks: [{ id: "1", type: "text", text: "Hello! How can I help you with your ad campaign today?" }],
  },
  {
    role: "user",
    blocks: [{ id: "2", type: "text", text: "I need help writing better headlines" }],
  },
  {
    role: "assistant",
    blocks: [{ id: "3", type: "text", text: "I'd be happy to help! Let me suggest some headline improvements." }],
  },
];

export const mockAdsChatStates = {
  empty: { messages: [], isLoading: false, isLoadingHistory: false },
  loading: { messages: [], isLoading: true, status: "streaming" as const },
  loadingHistory: { messages: [], isLoadingHistory: true },
  withMessages: { messages: sampleMessages },
  streaming: { messages: sampleMessages, isLoading: true, status: "streaming" as const },
} satisfies Record<string, MockAdsChatState>;

export const withMockAdsChat = (mockState: MockAdsChatState): Decorator => {
  return (Story) => {
    useEffect(() => {
      window.__STORYBOOK_MOCK_ADS_CHAT__ = mockState;
      return () => {
        delete window.__STORYBOOK_MOCK_ADS_CHAT__;
      };
    }, []);

    window.__STORYBOOK_MOCK_ADS_CHAT__ = mockState;

    return <Story />;
  };
};
