import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";
import { ChatProvider } from "../Chat";
import type { UIMessage } from "ai";
import type { LanggraphChat, ChatSnapshot } from "langgraph-ai-sdk-react";

// Mock composer for testing context-aware components
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

// Global mock state that tests can modify
let mockSnapshotOverrides: Partial<ChatSnapshot<Record<string, unknown>>> = {};

// Mock the langgraph-ai-sdk-react module
vi.mock("langgraph-ai-sdk-react", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useChatSelector: vi.fn((chat, selector) => {
      const mockSnapshot = createMockSnapshotFromChat(chat);
      return selector(mockSnapshot);
    }),
    useChatSnapshot: vi.fn((chat) => createMockSnapshotFromChat(chat)),
    createSnapshot: vi.fn((chat) => createMockSnapshotFromChat(chat)),
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

// Create snapshot from chat instance, applying any test overrides
function createMockSnapshotFromChat(chat: any): ChatSnapshot<Record<string, unknown>> {
  const composer = chat?._testComposer ?? createMockComposer();
  const status = chat?._testStatus ?? mockSnapshotOverrides.status ?? "ready";
  const sendMessage = mockSnapshotOverrides.sendMessage ?? vi.fn();
  const stop = mockSnapshotOverrides.stop ?? vi.fn();

  return {
    messages: chat?._testMessages ?? [],
    state: {},
    status,
    error: undefined,
    tools: [],
    events: [],
    isLoadingHistory: false,
    isLoading: mockSnapshotOverrides.isLoading ?? false,
    isReady: status === "ready",
    threadId: "test-thread",
    rawMessages: [],
    composer: mockSnapshotOverrides.composer ?? composer,
    chat: chat ?? ({} as any),
    actions: {
      sendMessage,
      updateState: vi.fn(),
      setState: vi.fn(),
      stop,
      clearError: vi.fn(),
      setMessages: vi.fn(),
    },
    sendMessage,
    updateState: vi.fn(),
    setState: vi.fn(),
    stop,
    clearError: vi.fn(),
    setMessages: vi.fn(),
    ...mockSnapshotOverrides,
  } as ChatSnapshot<Record<string, unknown>>;
}

// Mock chat instance for testing
function createMockChat(overrides?: {
  status?: string;
  composer?: any;
  sendMessage?: any;
  stop?: any;
}): LanggraphChat<UIMessage, Record<string, unknown>> {
  const composer = overrides?.composer ?? createMockComposer();
  return {
    threadId: "test-thread",
    isNewChat: false,
    messages: [],
    langgraphMessages: [],
    langgraphState: {},
    status: overrides?.status ?? "ready",
    error: undefined,
    isLoading: false,
    isLoadingHistory: false,
    historyLoaded: true,
    composer,
    tools: [],
    events: [],
    exposedThreadId: "test-thread",
    sendLanggraphMessage: vi.fn(),
    runStateOnly: vi.fn(),
    setState: vi.fn(),
    loadState: vi.fn(),
    stop: overrides?.stop ?? vi.fn(),
    clearError: vi.fn(),
    loadHistoryOnce: vi.fn(),
    abortHistoryLoad: vi.fn(),
    setIsLoadingHistory: vi.fn(),
    clearPersistedState: vi.fn(),
    onEstablished: vi.fn(() => () => {}),
    generateId: vi.fn(() => "test-id"),
    sendMessage: overrides?.sendMessage ?? vi.fn(),
    // Internal test properties
    _testStatus: overrides?.status,
    _testComposer: composer,
  } as unknown as LanggraphChat<UIMessage, Record<string, unknown>>;
}

// Wrapper to provide chat context
function renderWithContext(
  ui: React.ReactElement,
  options?: {
    status?: string;
    composer?: any;
    sendMessage?: any;
    stop?: any;
  }
) {
  // Reset global overrides
  mockSnapshotOverrides = {};

  // Set up overrides that will be used by the mock
  if (options?.status) mockSnapshotOverrides.status = options.status as any;
  if (options?.composer) mockSnapshotOverrides.composer = options.composer;
  if (options?.sendMessage) mockSnapshotOverrides.sendMessage = options.sendMessage;
  if (options?.stop) mockSnapshotOverrides.stop = options.stop;

  const mockChat = createMockChat(options);
  return render(<ChatProvider chat={mockChat}>{ui}</ChatProvider>);
}

describe("Input", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockSnapshotOverrides = {};
  });

  describe("Textarea (context-aware)", () => {
    it("renders a textarea", () => {
      renderWithContext(<Input.Textarea placeholder="Type here..." />);
      expect(screen.getByPlaceholderText("Type here...")).toBeInTheDocument();
    });

    it("uses composer.text from context", () => {
      const composer = createMockComposer();
      composer.text = "Hello from context";
      renderWithContext(<Input.Textarea />, { composer });
      expect(screen.getByRole("textbox")).toHaveValue("Hello from context");
    });

    it("calls composer.setText on change", async () => {
      const user = userEvent.setup();
      const composer = createMockComposer();
      renderWithContext(<Input.Textarea />, { composer });

      await user.type(screen.getByRole("textbox"), "H");
      expect(composer.setText).toHaveBeenCalled();
    });

    it("is disabled when streaming", () => {
      renderWithContext(<Input.Textarea />, { status: "streaming" });
      expect(screen.getByRole("textbox")).toBeDisabled();
    });
  });

  describe("SubmitButton (context-aware)", () => {
    it("renders a submit button", () => {
      renderWithContext(<Input.SubmitButton>Send</Input.SubmitButton>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("calls sendMessage from context when clicked", async () => {
      const user = userEvent.setup();
      const composer = createMockComposer();
      composer.isReady = true;
      const sendMessage = vi.fn();
      renderWithContext(<Input.SubmitButton>Send</Input.SubmitButton>, { composer, sendMessage });

      await user.click(screen.getByRole("button"));
      expect(sendMessage).toHaveBeenCalled();
    });

    it("is disabled when composer is not ready", () => {
      const composer = createMockComposer();
      composer.isReady = false;
      renderWithContext(<Input.SubmitButton>Send</Input.SubmitButton>, { composer });
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("is disabled when streaming", () => {
      const composer = createMockComposer();
      composer.isReady = true;
      renderWithContext(<Input.SubmitButton>Send</Input.SubmitButton>, { status: "streaming", composer });
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("FileButton (context-aware)", () => {
    it("renders a file button", () => {
      renderWithContext(<Input.FileButton>Upload</Input.FileButton>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("is disabled when streaming", () => {
      renderWithContext(<Input.FileButton>Upload</Input.FileButton>, { status: "streaming" });
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("DropZone (context-aware)", () => {
    it("renders children", () => {
      renderWithContext(
        <Input.DropZone>
          <div data-testid="child">Content</div>
        </Input.DropZone>
      );
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
  });

  describe("AttachmentList (context-aware)", () => {
    it("renders nothing when no attachments", () => {
      const composer = createMockComposer();
      composer.attachments = [];
      renderWithContext(<Input.AttachmentList />, { composer });
      expect(screen.queryByTestId("attachment-list")).not.toBeInTheDocument();
    });
  });

  describe("compound usage", () => {
    it("renders textarea and submit button together in context", () => {
      const composer = createMockComposer();
      composer.isReady = true;
      renderWithContext(
        <>
          <Input.Textarea placeholder="Type..." />
          <Input.SubmitButton>Send</Input.SubmitButton>
        </>,
        { composer }
      );

      expect(screen.getByPlaceholderText("Type...")).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getByRole("button")).not.toBeDisabled();
    });

    it("renders with all input components", () => {
      renderWithContext(
        <Input.DropZone>
          <Input.AttachmentList />
          <Input.Textarea placeholder="Ask..." />
          <Input.FileButton>Upload</Input.FileButton>
          <Input.SubmitButton>Send</Input.SubmitButton>
        </Input.DropZone>
      );

      expect(screen.getByPlaceholderText("Ask...")).toBeInTheDocument();
      expect(screen.getAllByRole("button")).toHaveLength(2); // FileButton + SubmitButton
    });
  });
});
