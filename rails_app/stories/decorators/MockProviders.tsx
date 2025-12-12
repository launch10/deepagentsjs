import { useEffect, type ReactNode } from "react";
import type { Decorator } from "@storybook/react-vite";
import type { AdsGraphState } from "@shared";

const mockPageProps = {
  thread_id: "storybook-thread-123",
  jwt: "mock-jwt-token",
  langgraph_path: "http://localhost:3001",
};

let pagePropsOverride: Record<string, unknown> = {};

export function setMockPageProps(props: Record<string, unknown>) {
  pagePropsOverride = props;
}

export function getMockPageProps() {
  return { ...mockPageProps, ...pagePropsOverride };
}

if (typeof window !== "undefined") {
  (window as any).__INERTIA_PAGE_PROPS__ = getMockPageProps();
}

export type MockAdsChatState = {
  messages?: Array<{
    role: "assistant" | "user";
    blocks: { id: string; type: string; text?: string }[];
  }>;
  state?: Partial<AdsGraphState>;
  isLoading?: boolean;
  isLoadingHistory?: boolean;
  threadId?: string;
};

const defaultMockState: MockAdsChatState = {
  messages: [],
  state: {},
  isLoading: false,
  isLoadingHistory: false,
  threadId: "storybook-thread-123",
};

let mockAdsChatState: MockAdsChatState = { ...defaultMockState };

export function setMockAdsChatState(state: Partial<MockAdsChatState>) {
  mockAdsChatState = { ...defaultMockState, ...state };
}

export function getMockAdsChatState() {
  return mockAdsChatState;
}

export function resetMockState() {
  pagePropsOverride = {};
  mockAdsChatState = { ...defaultMockState };
}

export const withMockProviders: Decorator = (Story, context) => {
  useEffect(() => {
    return () => resetMockState();
  }, []);

  if (context.parameters?.mockPageProps) {
    setMockPageProps(context.parameters.mockPageProps);
  }

  if (context.parameters?.mockAdsChatState) {
    setMockAdsChatState(context.parameters.mockAdsChatState);
  }

  return <Story />;
};

export const sampleMessages = [
  {
    role: "assistant" as const,
    blocks: [{ id: "1", type: "text", text: "Hello! How can I help you with your ad campaign today?" }],
  },
  {
    role: "user" as const,
    blocks: [{ id: "2", type: "text", text: "I need help writing better headlines" }],
  },
  {
    role: "assistant" as const,
    blocks: [{ id: "3", type: "text", text: "I'd be happy to help! Let me suggest some headline improvements based on your product." }],
  },
];

export const mockStates = {
  empty: {
    messages: [],
    isLoading: false,
    isLoadingHistory: false,
  },
  loading: {
    messages: [],
    isLoading: true,
    isLoadingHistory: false,
  },
  loadingHistory: {
    messages: [],
    isLoading: false,
    isLoadingHistory: true,
  },
  withMessages: {
    messages: sampleMessages,
    isLoading: false,
    isLoadingHistory: false,
  },
  streaming: {
    messages: sampleMessages,
    isLoading: true,
    isLoadingHistory: false,
  },
} satisfies Record<string, MockAdsChatState>;
