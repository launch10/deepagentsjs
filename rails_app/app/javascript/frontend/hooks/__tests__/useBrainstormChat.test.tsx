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
  }> = {}
) => ({
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
    updateState: vi.fn(),
    ...overrides.actions,
  },
  ...overrides,
});

let mockSnapshot = createMockSnapshot();

// Mock chat instance
const mockChat = {
  getSnapshot: () => mockSnapshot,
  subscribe: vi.fn((_callback: () => void) => {
    // Return unsubscribe function
    return () => {};
  }),
};

// Mock langgraph-ai-sdk-react
vi.mock("langgraph-ai-sdk-react", () => ({
  createChat: vi.fn(() => mockChat),
  useChatSelector: vi.fn((_chat: any, selector: (s: any) => any) => {
    return selector(mockSnapshot);
  }),
  useChatSnapshot: vi.fn(() => mockSnapshot),
}));

// Import after mocks are set up
import {
  useBrainstormChat,
  useBrainstormChatSelector,
  useBrainstormChatSnapshot,
  useBrainstormChatMessages,
  useBrainstormChatStateWithChat,
  useBrainstormChatStatus,
  useBrainstormChatComposer,
  useBrainstormChatActions,
  useBrainstormIsNewConversation,
  useBrainstormChatIsStreaming,
} from "@components/brainstorm/hooks/useBrainstormChat";
import { createChat } from "langgraph-ai-sdk-react";

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
      expect(createChat).toHaveBeenCalled();
    });

    it("creates chat with correct options", () => {
      renderHook(() => useBrainstormChat());

      expect(createChat).toHaveBeenCalledWith(
        expect.objectContaining({
          api: "http://localhost:3001/api/brainstorm/stream",
          threadId: "test-thread-123",
          headers: expect.objectContaining({
            Authorization: "Bearer test-jwt-token",
          }),
        })
      );
    });
  });

  describe("useBrainstormChatSelector", () => {
    it("applies selector to snapshot", () => {
      const { result: chatResult } = renderHook(() => useBrainstormChat());

      const { result } = renderHook(() =>
        useBrainstormChatSelector(chatResult.current, (s) => s.status)
      );

      expect(result.current).toBe("idle");
    });
  });

  describe("useBrainstormChatSnapshot", () => {
    it("returns full snapshot", () => {
      const { result: chatResult } = renderHook(() => useBrainstormChat());

      const { result } = renderHook(() =>
        useBrainstormChatSnapshot(chatResult.current)
      );

      expect(result.current).toHaveProperty("messages");
      expect(result.current).toHaveProperty("state");
      expect(result.current).toHaveProperty("actions");
    });
  });

  describe("useBrainstormChatMessages", () => {
    it("returns messages from snapshot", () => {
      mockSnapshot = createMockSnapshot({
        messages: [{ role: "human", content: "Hello" }],
      });

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormChatMessages(chatResult.current)
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual({ role: "human", content: "Hello" });
    });
  });

  describe("useBrainstormChatStateWithChat", () => {
    it("returns specific state key", () => {
      mockSnapshot = createMockSnapshot({
        state: { currentTopic: "audience" },
      });

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormChatStateWithChat(chatResult.current, "currentTopic")
      );

      expect(result.current).toBe("audience");
    });
  });

  describe("useBrainstormChatStatus", () => {
    it("returns status from snapshot", () => {
      mockSnapshot = createMockSnapshot({ status: "streaming" });

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormChatStatus(chatResult.current)
      );

      expect(result.current).toBe("streaming");
    });
  });

  describe("useBrainstormChatComposer", () => {
    it("returns composer from snapshot", () => {
      const mockComposer = createMockComposer({ text: "Hello world" });
      mockSnapshot = createMockSnapshot({ composer: mockComposer });

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormChatComposer(chatResult.current)
      );

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

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormIsNewConversation(chatResult.current)
      );

      expect(result.current).toBe(true);
    });

    it("returns false when messages exist", () => {
      mockSnapshot = createMockSnapshot({
        messages: [{ role: "human", content: "Hi" }],
      });

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormIsNewConversation(chatResult.current)
      );

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

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormIsNewConversation(chatResult.current)
      );

      expect(result.current).toBe(false);
    });
  });

  describe("useBrainstormChatIsStreaming", () => {
    it("returns true when status is streaming", () => {
      mockSnapshot = createMockSnapshot({ status: "streaming" });

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormChatIsStreaming(chatResult.current)
      );

      expect(result.current).toBe(true);
    });

    it("returns true when status is submitted", () => {
      mockSnapshot = createMockSnapshot({ status: "submitted" });

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormChatIsStreaming(chatResult.current)
      );

      expect(result.current).toBe(true);
    });

    it("returns false when status is idle", () => {
      mockSnapshot = createMockSnapshot({ status: "idle" });

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormChatIsStreaming(chatResult.current)
      );

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

      const { result: chatResult } = renderHook(() => useBrainstormChat());
      const { result } = renderHook(() =>
        useBrainstormChatActions(chatResult.current)
      );

      expect(result.current.sendMessage).toBe(mockSendMessage);
      expect(result.current.stop).toBe(mockStop);
    });
  });
});
