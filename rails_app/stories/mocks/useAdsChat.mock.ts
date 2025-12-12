import type { AdsGraphState } from "@shared";

export type MockMessage = {
  role: "assistant" | "user";
  blocks: { id: string; type: string; text?: string }[];
};

export type MockAdsChatSnapshot = {
  messages: MockMessage[];
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

export const sampleMessages: MockMessage[] = [
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

export function createMockSnapshot(overrides: Partial<MockAdsChatSnapshot> = {}): MockAdsChatSnapshot {
  return {
    messages: [],
    state: {},
    status: "idle",
    isLoading: false,
    isLoadingHistory: false,
    threadId: "storybook-thread",
    sendMessage: (msg) => console.log("[Mock] sendMessage:", msg),
    updateState: (updates) => console.log("[Mock] updateState:", updates),
    setState: (state) => console.log("[Mock] setState:", state),
    stop: () => console.log("[Mock] stop"),
    ...overrides,
  };
}

export const mockSnapshots = {
  empty: createMockSnapshot(),
  loading: createMockSnapshot({ isLoading: true, status: "streaming" }),
  loadingHistory: createMockSnapshot({ isLoadingHistory: true }),
  withMessages: createMockSnapshot({ messages: sampleMessages }),
  streaming: createMockSnapshot({ messages: sampleMessages, isLoading: true, status: "streaming" }),
};
