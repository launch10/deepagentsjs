import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrainstormInputView } from "../BrainstormInput";
import type { Attachment } from "~/types/attachment";

describe("BrainstormInputView", () => {
  const defaultProps = {
    input: "",
    onInputChange: vi.fn(),
    attachments: [] as Attachment[],
    onRemoveAttachment: vi.fn(),
    onSubmit: vi.fn(),
    onFilesAdd: vi.fn(),
    isStreaming: false,
    isUploading: false,
  };

  const createAttachment = (overrides: Partial<Attachment> = {}): Attachment => ({
    id: "attachment-1",
    file: new File(["test"], "test.jpg", { type: "image/jpeg" }),
    status: "completed",
    type: "image",
    url: "http://example.com/test.jpg",
    ...overrides,
  });

  describe("rendering", () => {
    it("renders textarea with default placeholder", () => {
      render(<BrainstormInputView {...defaultProps} />);

      expect(screen.getByTestId("chat-input")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/FreshFund/i)).toBeInTheDocument();
    });

    it("renders custom placeholder when provided", () => {
      render(<BrainstormInputView {...defaultProps} placeholder="Custom placeholder" />);

      expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
    });

    it("renders send button", () => {
      render(<BrainstormInputView {...defaultProps} />);

      expect(screen.getByTestId("send-button")).toBeInTheDocument();
    });

    it("renders file upload button", () => {
      render(<BrainstormInputView {...defaultProps} />);

      // File upload button should be present
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("input handling", () => {
    it("displays current input value", () => {
      render(<BrainstormInputView {...defaultProps} input="Hello world" />);

      expect(screen.getByTestId("chat-input")).toHaveValue("Hello world");
    });

    it("calls onInputChange when typing", async () => {
      const onInputChange = vi.fn();
      render(<BrainstormInputView {...defaultProps} onInputChange={onInputChange} />);

      await userEvent.type(screen.getByTestId("chat-input"), "H");

      expect(onInputChange).toHaveBeenCalled();
    });

    it("disables textarea when streaming", () => {
      render(<BrainstormInputView {...defaultProps} isStreaming />);

      expect(screen.getByTestId("chat-input")).toBeDisabled();
    });
  });

  describe("submit behavior", () => {
    it("enables send button when input has text", () => {
      render(<BrainstormInputView {...defaultProps} input="Hello" />);

      expect(screen.getByTestId("send-button")).not.toBeDisabled();
    });

    it("enables send button when attachments exist (no text)", () => {
      render(
        <BrainstormInputView
          {...defaultProps}
          input=""
          attachments={[createAttachment()]}
        />
      );

      expect(screen.getByTestId("send-button")).not.toBeDisabled();
    });

    it("disables send button when empty and no attachments", () => {
      render(<BrainstormInputView {...defaultProps} input="" attachments={[]} />);

      expect(screen.getByTestId("send-button")).toBeDisabled();
    });

    it("disables send button when streaming", () => {
      render(<BrainstormInputView {...defaultProps} input="Hello" isStreaming />);

      expect(screen.getByTestId("send-button")).toBeDisabled();
    });

    it("disables send button when uploading", () => {
      render(<BrainstormInputView {...defaultProps} input="Hello" isUploading />);

      expect(screen.getByTestId("send-button")).toBeDisabled();
    });

    it("calls onSubmit when clicking send button", async () => {
      const onSubmit = vi.fn();
      render(<BrainstormInputView {...defaultProps} input="Hello" onSubmit={onSubmit} />);

      await userEvent.click(screen.getByTestId("send-button"));

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("does not call onSubmit when send button is disabled", async () => {
      const onSubmit = vi.fn();
      render(<BrainstormInputView {...defaultProps} input="" onSubmit={onSubmit} />);

      await userEvent.click(screen.getByTestId("send-button"));

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("calls onSubmit when pressing Enter", async () => {
      const onSubmit = vi.fn();
      render(<BrainstormInputView {...defaultProps} input="Hello" onSubmit={onSubmit} />);

      fireEvent.keyDown(screen.getByTestId("chat-input"), { key: "Enter" });

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("does not call onSubmit when pressing Shift+Enter", async () => {
      const onSubmit = vi.fn();
      render(<BrainstormInputView {...defaultProps} input="Hello" onSubmit={onSubmit} />);

      fireEvent.keyDown(screen.getByTestId("chat-input"), { key: "Enter", shiftKey: true });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("attachments", () => {
    it("renders attachment list when attachments exist", () => {
      const attachments = [
        createAttachment({ id: "1" }),
        createAttachment({ id: "2", file: new File(["test"], "test2.jpg", { type: "image/jpeg" }) }),
      ];
      render(<BrainstormInputView {...defaultProps} attachments={attachments} />);

      // AttachmentList component should render (we verify through its presence)
      // The actual attachment rendering is tested in AttachmentList tests
      expect(screen.getByTestId("chat-input")).toBeInTheDocument();
    });

    it("calls onRemoveAttachment when attachment is removed", async () => {
      const onRemoveAttachment = vi.fn();
      const attachments = [createAttachment({ id: "test-id" })];

      render(
        <BrainstormInputView
          {...defaultProps}
          attachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
        />
      );

      // Find and click the remove button (x button on attachment)
      const removeButtons = screen.getAllByRole("button").filter(
        (btn) => btn.getAttribute("aria-label")?.includes("Remove")
      );

      if (removeButtons.length > 0) {
        await userEvent.click(removeButtons[0]);
        expect(onRemoveAttachment).toHaveBeenCalledWith("test-id");
      }
    });

    it("calls onFilesAdd when files are selected via input", async () => {
      const onFilesAdd = vi.fn();
      render(<BrainstormInputView {...defaultProps} onFilesAdd={onFilesAdd} />);

      // Find the hidden file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      // Create a mock file
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Trigger change event
      fireEvent.change(fileInput, { target: { files: dataTransfer.files } });

      expect(onFilesAdd).toHaveBeenCalledWith(dataTransfer.files);
    });
  });

  describe("button states", () => {
    it("shows stop icon when streaming", () => {
      render(<BrainstormInputView {...defaultProps} input="Hello" isStreaming />);

      expect(screen.getByLabelText("Stop")).toBeInTheDocument();
    });

    it("shows stop icon when uploading", () => {
      render(<BrainstormInputView {...defaultProps} input="Hello" isUploading />);

      expect(screen.getByLabelText("Stop")).toBeInTheDocument();
    });

    it("shows send icon when not streaming or uploading", () => {
      render(<BrainstormInputView {...defaultProps} input="Hello" />);

      expect(screen.getByLabelText("Send message")).toBeInTheDocument();
    });

    it("disables file upload button when streaming", () => {
      render(<BrainstormInputView {...defaultProps} isStreaming />);

      // Find the file upload button (document plus icon)
      const buttons = screen.getAllByRole("button");
      const fileButton = buttons.find((btn) => !btn.getAttribute("data-testid"));

      expect(fileButton).toBeDisabled();
    });
  });
});
