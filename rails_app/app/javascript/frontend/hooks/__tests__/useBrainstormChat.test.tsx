import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useBrainstormChat,
  useBrainstormChatActions,
  useBrainstormChatComposer,
  useBrainstormChatMessages,
  useBrainstormChatState,
  useBrainstormChatStatus,
  useBrainstormIsNewConversation,
  useBrainstormChatIsStreaming,
} from "../useBrainstormChat";
import type { BrainstormGraphState } from "@shared";

// Mock Inertia's usePage
vi.mock("@inertiajs/react", () => ({
  usePage: vi.fn(() => ({
    props: {
      thread_id: "test-thread-123",
      jwt: "test-jwt-token",
      langgraph_path: "http://localhost:3001",
    },
  })),
}));

// Mock the upload service
const mockUploadCreate = vi.fn();
vi.mock("@api/uploads", () => ({
  UploadService: vi.fn().mockImplementation(() => ({
    create: mockUploadCreate,
  })),
}));

// Create mock composer with all methods
const createMockComposer = (overrides: Partial<ReturnType<typeof createMockComposer>> = {}) => ({
  text: "",
  setText: vi.fn(),
  attachments: [],
  addFiles: vi.fn(),
  removeAttachment: vi.fn(),
  isReady: false,
  isUploading: false,
  ...overrides,
});

// Create mock sendMessage
const mockSendMessage = vi.fn();

// Create a mock snapshot factory
const createMockSnapshot = (overrides: Partial<{
  messages: any[];
  state: Partial<BrainstormGraphState>;
  status: string;
  isLoading: boolean;
  isLoadingHistory: boolean;
  threadId: string | null;
  composer: ReturnType<typeof createMockComposer>;
  actions: { sendMessage: typeof mockSendMessage; [key: string]: any };
}> = {}) => ({
  messages: [],
  state: {
    currentTopic: "idea",
    placeholderText: "Test placeholder",
    memories: {},
    skippedTopics: [],
    remainingTopics: ["idea", "audience", "solution", "socialProof", "lookAndFeel"],
    availableCommands: ["helpMe"],
    ...overrides.state,
  } as BrainstormGraphState,
  status: "idle",
  isLoading: false,
  isLoadingHistory: false,
  threadId: "test-thread-123",
  composer: createMockComposer(overrides.composer),
  actions: {
    sendMessage: mockSendMessage,
    stop: vi.fn(),
    reload: vi.fn(),
    ...overrides.actions,
  },
  ...overrides,
});

let mockSnapshot = createMockSnapshot();

// Mock langgraph-ai-sdk-react
vi.mock("langgraph-ai-sdk-react", () => ({
  useLanggraph: vi.fn(() => mockSnapshot),
}));

describe("useBrainstormChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSnapshot = createMockSnapshot();
    mockUploadCreate.mockReset();
    mockSendMessage.mockReset();
  });

  describe("useBrainstormChat selector", () => {
    it("returns full snapshot when no selector provided", () => {
      const { result } = renderHook(() => useBrainstormChat());

      expect(result.current).toHaveProperty("messages");
      expect(result.current).toHaveProperty("state");
      expect(result.current).toHaveProperty("actions");
      expect(result.current).toHaveProperty("composer");
    });

    it("applies selector function to snapshot", () => {
      const { result } = renderHook(() => useBrainstormChat((s) => s.status));

      expect(result.current).toBe("idle");
    });
  });

  describe("useBrainstormChatMessages", () => {
    it("returns messages from snapshot", () => {
      mockSnapshot = createMockSnapshot({
        messages: [{ role: "human", content: "Hello" }],
      });

      const { result } = renderHook(() => useBrainstormChatMessages());

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual({ role: "human", content: "Hello" });
    });
  });

  describe("useBrainstormChatState", () => {
    it("returns specific state key", () => {
      mockSnapshot = createMockSnapshot({
        state: { currentTopic: "audience" },
      });

      const { result } = renderHook(() => useBrainstormChatState("currentTopic"));

      expect(result.current).toBe("audience");
    });
  });

  describe("useBrainstormChatStatus", () => {
    it("returns status from snapshot", () => {
      mockSnapshot = createMockSnapshot({ status: "streaming" });

      const { result } = renderHook(() => useBrainstormChatStatus());

      expect(result.current).toBe("streaming");
    });
  });

  describe("useBrainstormChatComposer", () => {
    it("returns composer from snapshot", () => {
      const mockComposer = createMockComposer({ text: "Hello world" });
      mockSnapshot = createMockSnapshot({ composer: mockComposer });

      const { result } = renderHook(() => useBrainstormChatComposer());

      expect(result.current.text).toBe("Hello world");
      expect(result.current.setText).toBeDefined();
      expect(result.current.addFiles).toBeDefined();
    });
  });

  describe("useBrainstormIsNewConversation", () => {
    it("returns true when messages is empty", () => {
      mockSnapshot = createMockSnapshot({ messages: [] });

      const { result } = renderHook(() => useBrainstormIsNewConversation());

      expect(result.current).toBe(true);
    });

    it("returns false when messages exist", () => {
      mockSnapshot = createMockSnapshot({
        messages: [{ role: "human", content: "Hi" }],
      });

      const { result } = renderHook(() => useBrainstormIsNewConversation());

      expect(result.current).toBe(false);
    });
  });

  describe("useBrainstormChatIsStreaming", () => {
    it("returns true when status is streaming", () => {
      mockSnapshot = createMockSnapshot({ status: "streaming" });

      const { result } = renderHook(() => useBrainstormChatIsStreaming());

      expect(result.current).toBe(true);
    });

    it("returns true when status is submitted", () => {
      mockSnapshot = createMockSnapshot({ status: "submitted" });

      const { result } = renderHook(() => useBrainstormChatIsStreaming());

      expect(result.current).toBe(true);
    });

    it("returns false when status is idle", () => {
      mockSnapshot = createMockSnapshot({ status: "idle" });

      const { result } = renderHook(() => useBrainstormChatIsStreaming());

      expect(result.current).toBe(false);
    });
  });

  describe("useBrainstormChatActions", () => {
    describe("guardedSendMessage", () => {
      it("blocks no-arg calls when composer is not ready", () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        mockSnapshot = createMockSnapshot({
          composer: createMockComposer({ isReady: false }),
        });

        const { result } = renderHook(() => useBrainstormChatActions());
        result.current.sendMessage();

        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          "[useBrainstormChatActions] Blocked: composer not ready"
        );
        consoleSpy.mockRestore();
      });

      it("allows no-arg calls when composer is ready", () => {
        mockSnapshot = createMockSnapshot({
          composer: createMockComposer({ isReady: true, text: "Hello" }),
        });

        const { result } = renderHook(() => useBrainstormChatActions());
        result.current.sendMessage();

        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        expect(mockSendMessage).toHaveBeenCalledWith();
      });

      it("allows no-arg calls when composer has attachments only", () => {
        mockSnapshot = createMockSnapshot({
          composer: createMockComposer({
            isReady: true,
            text: "",
            attachments: [{ id: "1", status: "completed", url: "http://example.com/image.jpg" }],
          }),
        });

        const { result } = renderHook(() => useBrainstormChatActions());
        result.current.sendMessage();

        expect(mockSendMessage).toHaveBeenCalledTimes(1);
      });

      it("blocks empty text-based calls", () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        mockSnapshot = createMockSnapshot();

        const { result } = renderHook(() => useBrainstormChatActions());
        result.current.sendMessage("");

        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          "[useBrainstormChatActions] Blocked empty message submission"
        );
        consoleSpy.mockRestore();
      });

      it("blocks whitespace-only text-based calls", () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        mockSnapshot = createMockSnapshot();

        const { result } = renderHook(() => useBrainstormChatActions());
        result.current.sendMessage("   ");

        expect(mockSendMessage).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it("allows text-based calls with content", () => {
        mockSnapshot = createMockSnapshot();

        const { result } = renderHook(() => useBrainstormChatActions());
        result.current.sendMessage("Hello world");

        expect(mockSendMessage).toHaveBeenCalledWith("Hello world", undefined);
      });

      it("allows text-based calls with additional state", () => {
        mockSnapshot = createMockSnapshot();

        const { result } = renderHook(() => useBrainstormChatActions());
        result.current.sendMessage("Hello", { command: "helpMe" });

        expect(mockSendMessage).toHaveBeenCalledWith("Hello", { command: "helpMe" });
      });

      it("allows empty text with additional state", () => {
        mockSnapshot = createMockSnapshot();

        const { result } = renderHook(() => useBrainstormChatActions());
        result.current.sendMessage("", { command: "skip" });

        expect(mockSendMessage).toHaveBeenCalledWith("", { command: "skip" });
      });

      it("treats undefined first arg same as no-arg call", () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        mockSnapshot = createMockSnapshot({
          composer: createMockComposer({ isReady: false }),
        });

        const { result } = renderHook(() => useBrainstormChatActions());
        result.current.sendMessage(undefined);

        expect(mockSendMessage).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          "[useBrainstormChatActions] Blocked: composer not ready"
        );
        consoleSpy.mockRestore();
      });
    });

    it("exposes other actions unchanged", () => {
      const mockStop = vi.fn();
      const mockReload = vi.fn();
      mockSnapshot = createMockSnapshot({
        actions: {
          sendMessage: mockSendMessage,
          stop: mockStop,
          reload: mockReload,
        },
      });

      const { result } = renderHook(() => useBrainstormChatActions());

      expect(result.current.stop).toBe(mockStop);
      expect(result.current.reload).toBe(mockReload);
    });
  });
});
