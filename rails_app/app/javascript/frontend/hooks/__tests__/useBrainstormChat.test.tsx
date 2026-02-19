import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { BrainstormGraphState } from "@shared";

// Mock Inertia's usePage
const mockUsePage = vi.fn(() => ({
  props: {
    thread_id: "test-thread-123",
    jwt: "test-jwt-token",
    langgraph_path: "http://localhost:3001",
    root_path: "http://localhost:3000",
  },
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => mockUsePage(),
  router: {
    push: vi.fn(),
  },
}));

// Mock the upload service
const mockUploadCreate = vi.fn();
vi.mock("@rails_api_base", () => ({
  UploadsAPIService: vi.fn().mockImplementation(() => ({
    create: mockUploadCreate,
  })),
}));

// Mock composer type
interface MockComposer {
  text: string;
  setText: ReturnType<typeof vi.fn>;
  attachments: unknown[];
  addFiles: ReturnType<typeof vi.fn>;
  addFileUrl: ReturnType<typeof vi.fn>;
  addImageUrl: ReturnType<typeof vi.fn>;
  addAttachment: ReturnType<typeof vi.fn>;
  removeAttachment: ReturnType<typeof vi.fn>;
  retryAttachment: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  isReady: boolean;
  isUploading: boolean;
  isEmpty: boolean;
  hasErrors: boolean;
}

// Create mock composer with all methods
const createMockComposer = (overrides: Partial<MockComposer> = {}): MockComposer => ({
  text: "",
  setText: vi.fn(),
  attachments: [],
  addFiles: vi.fn(),
  addFileUrl: vi.fn(),
  addImageUrl: vi.fn(),
  addAttachment: vi.fn(),
  removeAttachment: vi.fn(),
  retryAttachment: vi.fn(),
  clear: vi.fn(),
  isReady: false,
  isUploading: false,
  isEmpty: true,
  hasErrors: false,
  ...overrides,
});

// Create mock sendMessage
const mockSendMessage = vi.fn();

// Mock chat instance
const mockChat = {
  getSnapshot: () => mockSnapshot,
  subscribe: vi.fn((_callback: () => void) => {
    // Return unsubscribe function
    return () => {};
  }),
};

// Create a mock snapshot factory
const createMockSnapshot = (
  overrides: Partial<{
    messages: any[];
    state: Partial<BrainstormGraphState>;
    status: string;
    isLoading: boolean;
    isLoadingHistory: boolean;
    threadId: string | null;
    composer: ReturnType<typeof createMockComposer>;
    actions: { sendMessage: typeof mockSendMessage; [key: string]: any };
    chat: any;
  }> = {}
) => ({
  messages: [],
  state: {
    currentTopic: "idea",
    placeholderText: "Test placeholder",
    memories: {},
    skippedTopics: [],
    remainingTopics: ["idea", "audience", "solution", "socialProof", "lookAndFeel"],
    availableIntents: ["help_me"],
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
    updateState: vi.fn(),
    ...overrides.actions,
  },
  setMessages: vi.fn(),
  chat: overrides.chat ?? mockChat,
  ...overrides,
});

let mockSnapshot = createMockSnapshot();

// Mock langgraph-ai-sdk-react
vi.mock("langgraph-ai-sdk-react", () => ({
  useLanggraph: vi.fn((_options: any, selector: (s: any) => any) => {
    // Apply selector to snapshot - if it selects chat, return mockChat
    const result = selector(mockSnapshot);
    if (result === mockSnapshot.chat) {
      return mockChat;
    }
    return result;
  }),
}));

// Import after mocks are set up
import {
  useBrainstormChat,
  useBrainstormSelector,
  useBrainstormMessages,
  useBrainstormStatus,
  useBrainstormComposer,
  useBrainstormActions,
  useBrainstormIsNewConversation,
  useBrainstormIsStreaming,
} from "@components/brainstorm/hooks/useBrainstormChat";
import { useLanggraph } from "langgraph-ai-sdk-react";

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
        root_path: "http://localhost:3000",
      },
    });
  });

  describe("useBrainstormChat", () => {
    it("returns a chat instance", () => {
      const { result } = renderHook(() => useBrainstormChat());

      expect(result.current).toBe(mockChat);
      expect(useLanggraph).toHaveBeenCalled();
    });

    it("calls useLanggraph with correct options", () => {
      renderHook(() => useBrainstormChat());

      expect(useLanggraph).toHaveBeenCalledWith(
        expect.objectContaining({
          api: "http://localhost:3001/api/brainstorm/stream",
          headers: expect.objectContaining({
            Authorization: "Bearer test-jwt-token",
          }),
        }),
        expect.any(Function)
      );
    });
  });

  describe("useBrainstormSelector", () => {
    it("applies selector to snapshot", () => {
      const { result } = renderHook(() => useBrainstormSelector((s) => s.status));

      expect(result.current).toBe("idle");
    });
  });

  describe("useBrainstormMessages", () => {
    it("returns messages from snapshot", () => {
      mockSnapshot = createMockSnapshot({
        messages: [{ role: "human", content: "Hello" }],
      });

      const { result } = renderHook(() => useBrainstormMessages());

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual({ role: "human", content: "Hello" });
    });
  });

  describe("useBrainstormStatus", () => {
    it("returns status from snapshot", () => {
      mockSnapshot = createMockSnapshot({ status: "streaming" });

      const { result } = renderHook(() => useBrainstormStatus());

      expect(result.current).toBe("streaming");
    });
  });

  describe("useBrainstormComposer", () => {
    it("returns composer from snapshot", () => {
      const mockComposer = createMockComposer({ text: "Hello world" });
      mockSnapshot = createMockSnapshot({ composer: mockComposer });

      const { result } = renderHook(() => useBrainstormComposer());

      expect(result.current.text).toBe("Hello world");
      expect(result.current.setText).toBeDefined();
      expect(result.current.addFiles).toBeDefined();
    });
  });

  describe("useBrainstormIsNewConversation", () => {
    it("returns true when messages is empty and no thread_id", () => {
      // Override usePage to return no thread_id (new conversation)
      mockUsePage.mockReturnValue({
        props: {
          thread_id: null as any,
          jwt: "test-jwt-token",
          langgraph_path: "http://localhost:3001",
          root_path: "http://localhost:3000",
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

    it("returns false when thread_id exists", () => {
      mockUsePage.mockReturnValue({
        props: {
          thread_id: "existing-thread",
          jwt: "test-jwt-token",
          langgraph_path: "http://localhost:3001",
          root_path: "http://localhost:3000",
        },
      });
      mockSnapshot = createMockSnapshot({ messages: [] });

      const { result } = renderHook(() => useBrainstormIsNewConversation());

      expect(result.current).toBe(false);
    });
  });

  describe("useBrainstormIsStreaming", () => {
    it("returns true when status is streaming", () => {
      mockSnapshot = createMockSnapshot({ status: "streaming" });

      const { result } = renderHook(() => useBrainstormIsStreaming());

      expect(result.current).toBe(true);
    });

    it("returns true when status is submitted", () => {
      mockSnapshot = createMockSnapshot({ status: "submitted" });

      const { result } = renderHook(() => useBrainstormIsStreaming());

      expect(result.current).toBe(true);
    });

    it("returns false when status is idle", () => {
      mockSnapshot = createMockSnapshot({ status: "idle" });

      const { result } = renderHook(() => useBrainstormIsStreaming());

      expect(result.current).toBe(false);
    });
  });

  describe("useBrainstormActions", () => {
    it("returns actions from snapshot", () => {
      const mockStop = vi.fn();
      mockSnapshot = createMockSnapshot({
        actions: {
          sendMessage: mockSendMessage,
          stop: mockStop,
        },
      });

      const { result } = renderHook(() => useBrainstormActions());

      expect(result.current.sendMessage).toBe(mockSendMessage);
      expect(result.current.stop).toBe(mockStop);
    });
  });
});
