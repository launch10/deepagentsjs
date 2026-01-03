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
} from "@components/brainstorm/hooks/useBrainstormChat";
import type { BrainstormGraphState } from "@shared";

// Mock Inertia's usePage
const mockUsePage = vi.fn(() => ({
  props: {
    thread_id: "test-thread-123",
    jwt: "test-jwt-token",
    langgraph_path: "http://localhost:3001",
  },
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => mockUsePage(),
}));

// Mock the upload service
const mockUploadCreate = vi.fn();
vi.mock("@api/uploads", () => ({
  UploadService: vi.fn().mockImplementation(() => ({
    create: mockUploadCreate,
  })),
}));

// Mock composer type
interface MockComposer {
  text: string;
  setText: ReturnType<typeof vi.fn>;
  attachments: unknown[];
  addFiles: ReturnType<typeof vi.fn>;
  removeAttachment: ReturnType<typeof vi.fn>;
  isReady: boolean;
  isUploading: boolean;
}

// Create mock composer with all methods
const createMockComposer = (overrides: Partial<MockComposer> = {}): MockComposer => ({
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
    // Reset usePage to default mock
    mockUsePage.mockReturnValue({
      props: {
        thread_id: "test-thread-123",
        jwt: "test-jwt-token",
        langgraph_path: "http://localhost:3001",
      },
    });
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
      // Override usePage to return no thread_id (new conversation)
      mockUsePage.mockReturnValue({
        props: {
          thread_id: undefined,
          jwt: "test-jwt-token",
          langgraph_path: "http://localhost:3001",
        },
      });
      mockSnapshot = createMockSnapshot({ messages: [], threadId: null });

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
    it("returns actions from snapshot", () => {
      const mockStop = vi.fn();
      mockSnapshot = createMockSnapshot({
        actions: {
          sendMessage: mockSendMessage,
          stop: mockStop,
        },
      });

      const { result } = renderHook(() => useBrainstormChatActions());

      expect(result.current.sendMessage).toBe(mockSendMessage);
      expect(result.current.stop).toBe(mockStop);
    });
  });
});
