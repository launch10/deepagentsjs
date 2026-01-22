import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrainstormInput } from "../shared/BrainstormInput";
import { ChatProvider } from "@components/shared/chat/ChatContext";
import type { ReactNode } from "react";
import type { UIMessage } from "ai";
import type { LanggraphChat, ChatSnapshot } from "langgraph-ai-sdk-react";

// Mock the hooks used by BrainstormInput
vi.mock("@components/brainstorm/hooks", () => ({
  useBrainstormSelector: vi.fn((selector) => {
    // Return placeholder text for the state.placeholderText selector
    const mockState = { placeholderText: null };
    return selector({ state: mockState });
  }),
}));

vi.mock("@lib/brainstormTextarea", () => ({
  setTextareaRef: vi.fn(),
}));

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
    text: "",
    attachments: [],
    isUploading: false,
    hasErrors: false,
    isReady: false,
    isEmpty: true,
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
  return {
    messages: chat?._testMessages ?? [],
    state: {},
    status: chat?._testStatus ?? "ready",
    error: undefined,
    tools: [],
    events: [],
    isLoadingHistory: false,
    isLoading: false,
    isReady: true,
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
    ...overrides,
  } as unknown as LanggraphChat<UIMessage, Record<string, unknown>>;
}

// Wrapper that provides Chat context
function ChatContextWrapper({ children }: { children: ReactNode }) {
  const mockChat = createMockChat();
  return (
    <ChatProvider chat={mockChat}>
      {children}
    </ChatProvider>
  );
}

describe("BrainstormInput", () => {
  it("renders the input components", () => {
    render(<BrainstormInput />, { wrapper: ChatContextWrapper });

    // Should render the textarea
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();

    // Should render the send button
    expect(screen.getByTestId("send-button")).toBeInTheDocument();
  });

  it("uses default placeholder when no custom placeholder", () => {
    render(<BrainstormInput />, { wrapper: ChatContextWrapper });

    expect(screen.getByPlaceholderText(/FreshFund/i)).toBeInTheDocument();
  });
});

/**
 * Note: Most input behavior tests have moved to the Chat compound component tests:
 * - Chat.Input.Textarea tests: text binding, Enter key handling, streaming disable
 * - Chat.Input.SubmitButton tests: submit/stop toggle, disabled states
 * - Chat.Input.FileButton tests: file selection, streaming disable
 * - Chat.Input.DropZone tests: drag & drop handling
 * - Chat.Input.AttachmentList tests: attachment display and removal
 *
 * BrainstormInput is now a thin wrapper that:
 * 1. Provides brainstorm-specific sendMessage (with workflow sync)
 * 2. Provides dynamic placeholder from backend state
 * 3. Registers textarea ref for external focus management
 *
 * @see app/javascript/frontend/components/chat/__tests__/Input.test.tsx
 */
