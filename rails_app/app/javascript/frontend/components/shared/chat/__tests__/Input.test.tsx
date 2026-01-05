import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";
import { Chat, ChatProvider } from "../Chat";
import type { ChatSnapshot } from "langgraph-ai-sdk-react";

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
    addImageUrl: vi.fn(),
    removeAttachment: vi.fn(),
    retryAttachment: vi.fn(),
    clear: vi.fn(),
  };
}

// Mock chat snapshot for testing
function createMockSnapshot(
  overrides?: Partial<ChatSnapshot<Record<string, unknown>>>
): ChatSnapshot<Record<string, unknown>> {
  const composer = createMockComposer();
  return {
    messages: [],
    state: {},
    status: "ready",
    error: undefined,
    tools: [],
    events: [],
    isLoadingHistory: false,
    isLoading: false,
    isReady: true,
    threadId: undefined,
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

// Wrapper to provide chat context
function renderWithContext(
  ui: React.ReactElement,
  snapshot?: ChatSnapshot<Record<string, unknown>>
) {
  const mockSnapshot = snapshot ?? createMockSnapshot();
  return render(<ChatProvider snapshot={mockSnapshot}>{ui}</ChatProvider>);
}

describe("Input", () => {
  describe("Textarea (context-aware)", () => {
    it("renders a textarea", () => {
      renderWithContext(<Input.Textarea placeholder="Type here..." />);
      expect(screen.getByPlaceholderText("Type here...")).toBeInTheDocument();
    });

    it("uses composer.text from context", () => {
      const snapshot = createMockSnapshot();
      (snapshot.composer as any).text = "Hello from context";
      renderWithContext(<Input.Textarea />, snapshot);
      expect(screen.getByRole("textbox")).toHaveValue("Hello from context");
    });

    it("calls composer.setText on change", async () => {
      const user = userEvent.setup();
      const snapshot = createMockSnapshot();
      renderWithContext(<Input.Textarea />, snapshot);

      await user.type(screen.getByRole("textbox"), "H");
      expect(snapshot.composer.setText).toHaveBeenCalled();
    });

    it("is disabled when streaming", () => {
      const snapshot = createMockSnapshot({ status: "streaming" });
      renderWithContext(<Input.Textarea />, snapshot);
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
      const snapshot = createMockSnapshot();
      (snapshot.composer as any).isReady = true;
      renderWithContext(<Input.SubmitButton>Send</Input.SubmitButton>, snapshot);

      await user.click(screen.getByRole("button"));
      expect(snapshot.sendMessage).toHaveBeenCalled();
    });

    it("is disabled when composer is not ready", () => {
      const snapshot = createMockSnapshot();
      (snapshot.composer as any).isReady = false;
      renderWithContext(<Input.SubmitButton>Send</Input.SubmitButton>, snapshot);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("is disabled when streaming", () => {
      const snapshot = createMockSnapshot({ status: "streaming" });
      (snapshot.composer as any).isReady = true;
      renderWithContext(<Input.SubmitButton>Send</Input.SubmitButton>, snapshot);
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("FileButton (context-aware)", () => {
    it("renders a file button", () => {
      renderWithContext(<Input.FileButton>Upload</Input.FileButton>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("is disabled when streaming", () => {
      const snapshot = createMockSnapshot({ status: "streaming" });
      renderWithContext(<Input.FileButton>Upload</Input.FileButton>, snapshot);
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
      const snapshot = createMockSnapshot();
      (snapshot.composer as any).attachments = [];
      renderWithContext(<Input.AttachmentList />, snapshot);
      expect(screen.queryByTestId("attachment-list")).not.toBeInTheDocument();
    });
  });

  describe("compound usage", () => {
    it("renders textarea and submit button together in context", () => {
      const snapshot = createMockSnapshot();
      (snapshot.composer as any).isReady = true;
      renderWithContext(
        <>
          <Input.Textarea placeholder="Type..." />
          <Input.SubmitButton>Send</Input.SubmitButton>
        </>,
        snapshot
      );

      expect(screen.getByPlaceholderText("Type...")).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getByRole("button")).not.toBeDisabled();
    });

    it("renders with all input components", () => {
      const snapshot = createMockSnapshot();
      renderWithContext(
        <Input.DropZone>
          <Input.AttachmentList />
          <Input.Textarea placeholder="Ask..." />
          <Input.FileButton>Upload</Input.FileButton>
          <Input.SubmitButton>Send</Input.SubmitButton>
        </Input.DropZone>,
        snapshot
      );

      expect(screen.getByPlaceholderText("Ask...")).toBeInTheDocument();
      expect(screen.getAllByRole("button")).toHaveLength(2); // FileButton + SubmitButton
    });
  });
});
