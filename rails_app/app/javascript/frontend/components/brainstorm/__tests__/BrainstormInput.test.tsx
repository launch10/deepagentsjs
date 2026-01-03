import { describe, it, expect, vi, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrainstormInput } from "../shared/BrainstormInput";
import { ChatContext, type ChatContextValue } from "@components/shared/chat/ChatContext";
import type { ReactNode } from "react";

// Mock the hooks used by BrainstormInput
vi.mock("@components/brainstorm/hooks/useBrainstormChat", () => ({
  useBrainstormChatState: () => null, // No custom placeholder
}));

vi.mock("@components/brainstorm/hooks/useBrainstormSendMessage", () => ({
  useBrainstormSendMessage: () => ({
    sendMessage: vi.fn(),
  }),
}));

vi.mock("@lib/brainstormTextarea", () => ({
  setTextareaRef: vi.fn(),
}));

// Create mock context value
const createMockContext = (): ChatContextValue => ({
  snapshot: {} as ChatContextValue["snapshot"],
  messages: [],
  composer: {
    text: "",
    setText: vi.fn(),
    attachments: [],
    addFiles: vi.fn(),
    removeAttachment: vi.fn(),
    retryAttachment: vi.fn(),
    addImageUrl: vi.fn(),
    clear: vi.fn(),
    isReady: false,
    isUploading: false,
    hasErrors: false,
    isEmpty: true,
  } as unknown as ChatContextValue["composer"],
  status: "idle" as ChatContextValue["status"],
  isStreaming: false,
  isLoading: false,
  sendMessage: vi.fn() as unknown as ChatContextValue["sendMessage"],
  submit: vi.fn(),
  stop: vi.fn() as unknown as ChatContextValue["stop"],
});

// Wrapper that provides Chat context
function ChatContextWrapper({ children }: { children: ReactNode }) {
  return (
    <ChatContext.Provider value={createMockContext()}>
      {children}
    </ChatContext.Provider>
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
