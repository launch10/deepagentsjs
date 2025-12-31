import { describe, it, expect, vi } from "vitest";
import { render, screen, renderHook } from "@testing-library/react";
import {
  ChatProvider,
  useChatContext,
  useChatMessages,
  useChatComposer,
  useChatIsStreaming,
  useChatIsLoading,
  useChatSendMessage,
  useChatStatus,
} from "../ChatContext";
import type { ChatSnapshot } from "langgraph-ai-sdk-react";

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
    addImageUrl: vi.fn(),
    removeAttachment: vi.fn(),
    retryAttachment: vi.fn(),
    clear: vi.fn(),
  };
}

// Mock chat snapshot for testing
function createMockSnapshot(overrides?: Partial<ChatSnapshot<Record<string, unknown>>>): ChatSnapshot<Record<string, unknown>> {
  const composer = createMockComposer();
  return {
    messages: [
      { id: "1", role: "user", blocks: [{ type: "text", text: "Hello", id: "b1", index: 0 }] },
      { id: "2", role: "assistant", blocks: [{ type: "text", text: "Hi there!", id: "b2", index: 0 }] },
    ] as any,
    state: {},
    status: "ready",
    error: undefined,
    tools: [],
    events: [],
    isLoadingHistory: false,
    isLoading: false,
    isReady: true,
    threadId: "test-thread",
    rawMessages: [],
    composer,
    chat: {} as any,
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
    ...overrides,
  } as ChatSnapshot<Record<string, unknown>>;
}

// Wrapper component for hook testing
function createWrapper(snapshot?: ChatSnapshot<Record<string, unknown>>) {
  const mockSnapshot = snapshot ?? createMockSnapshot();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ChatProvider snapshot={mockSnapshot}>{children}</ChatProvider>;
  };
}

describe("ChatContext", () => {
  describe("useChatContext", () => {
    it("throws error when used outside ChatProvider", () => {
      const { result } = renderHook(() => {
        try {
          useChatContext();
          return null;
        } catch (e) {
          return e as Error;
        }
      });
      expect(result.current).toBeInstanceOf(Error);
      expect((result.current as Error).message).toBe("useChatContext must be used within Chat.Root");
    });

    it("returns context value when inside ChatProvider", () => {
      const snapshot = createMockSnapshot();
      const { result } = renderHook(() => useChatContext(), {
        wrapper: createWrapper(snapshot),
      });
      expect(result.current).toBeDefined();
      expect(result.current.snapshot).toBe(snapshot);
    });

    it("provides convenience accessors", () => {
      const snapshot = createMockSnapshot();
      const { result } = renderHook(() => useChatContext(), {
        wrapper: createWrapper(snapshot),
      });

      expect(result.current.messages).toBe(snapshot.messages);
      expect(result.current.composer).toBe(snapshot.composer);
      expect(result.current.status).toBe(snapshot.status);
      expect(result.current.sendMessage).toBe(snapshot.sendMessage);
    });
  });

  describe("useChatMessages", () => {
    it("returns messages from context", () => {
      const snapshot = createMockSnapshot();
      const { result } = renderHook(() => useChatMessages(), {
        wrapper: createWrapper(snapshot),
      });
      expect(result.current).toBe(snapshot.messages);
    });
  });

  describe("useChatComposer", () => {
    it("returns composer from context", () => {
      const snapshot = createMockSnapshot();
      const { result } = renderHook(() => useChatComposer(), {
        wrapper: createWrapper(snapshot),
      });
      expect(result.current).toBe(snapshot.composer);
    });
  });

  describe("useChatIsStreaming", () => {
    it("returns false when status is ready", () => {
      const snapshot = createMockSnapshot({ status: "ready" });
      const { result } = renderHook(() => useChatIsStreaming(), {
        wrapper: createWrapper(snapshot),
      });
      expect(result.current).toBe(false);
    });

    it("returns true when status is streaming", () => {
      const snapshot = createMockSnapshot({ status: "streaming" });
      const { result } = renderHook(() => useChatIsStreaming(), {
        wrapper: createWrapper(snapshot),
      });
      expect(result.current).toBe(true);
    });

    it("returns true when status is submitted", () => {
      const snapshot = createMockSnapshot({ status: "submitted" });
      const { result } = renderHook(() => useChatIsStreaming(), {
        wrapper: createWrapper(snapshot),
      });
      expect(result.current).toBe(true);
    });
  });

  describe("useChatIsLoading", () => {
    it("returns isLoading from context", () => {
      const snapshot = createMockSnapshot({ isLoading: true });
      const { result } = renderHook(() => useChatIsLoading(), {
        wrapper: createWrapper(snapshot),
      });
      expect(result.current).toBe(true);
    });
  });

  describe("useChatSendMessage", () => {
    it("returns sendMessage from context", () => {
      const snapshot = createMockSnapshot();
      const { result } = renderHook(() => useChatSendMessage(), {
        wrapper: createWrapper(snapshot),
      });
      expect(result.current).toBe(snapshot.sendMessage);
    });
  });

  describe("useChatStatus", () => {
    it("returns status from context", () => {
      const snapshot = createMockSnapshot({ status: "streaming" });
      const { result } = renderHook(() => useChatStatus(), {
        wrapper: createWrapper(snapshot),
      });
      expect(result.current).toBe("streaming");
    });
  });

  describe("ChatProvider", () => {
    it("renders children", () => {
      const snapshot = createMockSnapshot();
      render(
        <ChatProvider snapshot={snapshot}>
          <div data-testid="child">Content</div>
        </ChatProvider>
      );
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
  });
});
