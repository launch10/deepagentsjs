import { describe, it, expect, vi } from "vitest";
import { render, screen, renderHook } from "@testing-library/react";
import type { UIMessage } from "ai";
import {
  ChatProvider,
  useChatFromContext,
  useChatContextSelector,
  useChatMessages,
  useChatComposer,
  useChatStatus,
  useChatIsStreaming,
} from "../ChatContext";
import type { LanggraphChat, ChatSnapshot } from "langgraph-ai-sdk-react";

// Mock the langgraph-ai-sdk-react module
vi.mock("langgraph-ai-sdk-react", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useChatSelector: vi.fn((chat, selector) => {
      // Mock the snapshot and apply the selector
      const mockSnapshot = createMockSnapshot(chat);
      return selector(mockSnapshot);
    }),
    useChatSnapshot: vi.fn((chat) => createMockSnapshot(chat)),
    createSnapshot: vi.fn((chat) => createMockSnapshot(chat)),
    ChatSelectors: {
      messages: (s: any) => s.messages,
      composer: (s: any) => s.composer,
      status: (s: any) => s.status,
      isStreaming: (s: any) => s.status === "streaming" || s.status === "submitted",
      isLoading: (s: any) => s.isLoading,
      isReady: (s: any) => s.isReady,
      actions: (s: any) => s.actions,
      error: (s: any) => s.error,
      threadId: (s: any) => s.threadId,
      state: (s: any) => s.state,
      stop: (s: any) => s.stop ?? s.actions?.stop,
    },
  };
});

// Mock composer for testing
function createMockComposer() {
  return {
    text: "test message",
    attachments: [],
    isUploading: false,
    hasErrors: false,
    isReady: true,
    isEmpty: false,
    setText: vi.fn(),
    addFiles: vi.fn(),
    addFileUrl: vi.fn(),
    addImageUrl: vi.fn(),
    addAttachment: vi.fn(),
    removeAttachment: vi.fn(),
    retryAttachment: vi.fn(),
    clear: vi.fn(),
  };
}

// Mock chat snapshot for testing
function createMockSnapshot(chat?: any): ChatSnapshot<Record<string, unknown>> {
  const composer = createMockComposer();
  const testMessages = chat?._testMessages ?? [
    { id: "1", role: "user", blocks: [{ type: "text", text: "Hello", id: "b1", index: 0 }] },
    { id: "2", role: "assistant", blocks: [{ type: "text", text: "Hi there!", id: "b2", index: 0 }] },
  ];
  const testStatus = chat?._testStatus ?? "ready";

  return {
    messages: testMessages as any,
    state: {},
    status: testStatus,
    error: undefined,
    tools: [],
    events: [],
    isLoadingHistory: false,
    isLoading: false,
    isReady: testStatus === "ready",
    threadId: "test-thread",
    rawMessages: [],
    composer,
    chat: chat ?? ({} as any),
    actions: {
      sendMessage: vi.fn(),
      updateState: vi.fn(),
      setState: vi.fn(),
      stop: vi.fn(),
      clearError: vi.fn(),
      setMessages: vi.fn(),
    },
    sendMessage: vi.fn(),
    updateState: vi.fn(),
    setState: vi.fn(),
    stop: vi.fn(),
    clearError: vi.fn(),
    setMessages: vi.fn(),
  } as ChatSnapshot<Record<string, unknown>>;
}

// Mock chat instance for testing
function createMockChat(overrides?: Record<string, any>): LanggraphChat<UIMessage, Record<string, unknown>> {
  return {
    threadId: "test-thread",
    isNewChat: false,
    messages: [],
    langgraphMessages: [],
    langgraphState: {},
    status: "ready",
    error: undefined,
    isLoading: false,
    isLoadingHistory: false,
    historyLoaded: true,
    composer: createMockComposer(),
    tools: [],
    events: [],
    exposedThreadId: "test-thread",
    sendLanggraphMessage: vi.fn(),
    runStateOnly: vi.fn(),
    setState: vi.fn(),
    loadState: vi.fn(),
    stop: vi.fn(),
    clearError: vi.fn(),
    loadHistoryOnce: vi.fn(),
    abortHistoryLoad: vi.fn(),
    setIsLoadingHistory: vi.fn(),
    clearPersistedState: vi.fn(),
    onEstablished: vi.fn(() => () => {}),
    generateId: vi.fn(() => "test-id"),
    sendMessage: vi.fn(),
    "~registerStateKeyCallback": vi.fn(() => () => {}),
    ...overrides,
  } as unknown as LanggraphChat<UIMessage, Record<string, unknown>>;
}

// Wrapper component for hook testing
function createWrapper(chat?: LanggraphChat<UIMessage, Record<string, unknown>>) {
  const mockChat = chat ?? createMockChat();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ChatProvider chat={mockChat}>{children}</ChatProvider>;
  };
}

describe("ChatContext", () => {
  describe("useChatFromContext", () => {
    it("throws error when used outside ChatProvider", () => {
      const { result } = renderHook(() => {
        try {
          useChatFromContext();
          return null;
        } catch (e) {
          return e as Error;
        }
      });
      expect(result.current).toBeInstanceOf(Error);
      expect((result.current as Error).message).toBe("useChatFromContext must be used within Chat.Root");
    });

    it("returns chat instance when inside ChatProvider", () => {
      const chat = createMockChat();
      const { result } = renderHook(() => useChatFromContext(), {
        wrapper: createWrapper(chat),
      });
      expect(result.current).toBe(chat);
    });
  });

  describe("useChatContextSelector", () => {
    it("throws error when used outside ChatProvider", () => {
      const { result } = renderHook(() => {
        try {
          useChatContextSelector((s) => s.status);
          return null;
        } catch (e) {
          return e as Error;
        }
      });
      expect(result.current).toBeInstanceOf(Error);
      expect((result.current as Error).message).toBe("useChatFromContext must be used within Chat.Root");
    });

    it("returns selected value from snapshot", () => {
      const chat = createMockChat();
      const { result } = renderHook(() => useChatContextSelector((s) => s.status), {
        wrapper: createWrapper(chat),
      });

      expect(result.current).toBe("ready");
    });
  });

  describe("ChatProvider", () => {
    it("renders children", () => {
      const chat = createMockChat();
      render(
        <ChatProvider chat={chat}>
          <div data-testid="child">Content</div>
        </ChatProvider>
      );
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("provides stable context value", () => {
      const chat = createMockChat();
      const values: any[] = [];

      function ContextCapture() {
        const value = useChatFromContext();
        values.push(value);
        return null;
      }

      const { rerender } = render(
        <ChatProvider chat={chat}>
          <ContextCapture />
        </ChatProvider>
      );

      // Rerender without changing chat
      rerender(
        <ChatProvider chat={chat}>
          <ContextCapture />
        </ChatProvider>
      );

      // Chat reference should be stable
      expect(values[0]).toBe(values[1]);
    });
  });
});
