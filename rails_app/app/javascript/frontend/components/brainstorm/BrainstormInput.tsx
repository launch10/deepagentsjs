import { useRef, useEffect, useCallback, useMemo } from "react";
import {
  useBrainstormChatIsStreaming,
  useBrainstormChatState,
  useBrainstormChatComposer,
} from "@hooks/useBrainstormChat";
import { useBrainstormSendMessage } from "~/hooks/useBrainstormSendMessage";
import { setTextareaRef } from "@lib/brainstormTextarea";
import { DocumentPlusIcon, ArrowUpIcon, StopIcon } from "@heroicons/react/24/outline";
import { AttachmentList, DropZone } from "./attachments";
import { FILE_INPUT_ACCEPT, type Attachment } from "~/types/attachment";

/**
 * Default placeholder text for the input.
 */
const DEFAULT_PLACEHOLDER = 'e.g. "FreshFund is a budgeting tool that helps freelancers track income and expenses."';

/**
 * Props for the BrainstormInputView presentation component.
 * Contains all data and callbacks needed for rendering without hooks.
 */
export interface BrainstormInputViewProps {
  /** Current input text value */
  input: string;
  /** Callback to update input text */
  onInputChange: (value: string) => void;
  /** Array of file attachments */
  attachments: Attachment[];
  /** Callback to remove an attachment by ID */
  onRemoveAttachment: (id: string) => void;
  /** Callback when form is submitted */
  onSubmit: () => void;
  /** Callback when files are added (via button or drop) */
  onFilesAdd: (files: FileList) => void;
  /** Whether the chat is currently streaming a response */
  isStreaming: boolean;
  /** Whether files are currently uploading */
  isUploading: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Ref to register for external focus management */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Pure presentation component for brainstorm input.
 * Renders the input area, attachments, and submit button.
 * Can be used in Storybook and unit tests without mocking hooks.
 *
 * NOTE: This component uses direct zustand state instead of react-hook-form
 * (unlike AdsChatInput) because:
 * 1. Attachment handling requires async upload tracking with progress states
 * 2. Message + attachments form complex submission logic (uploadIds must be
 *    resolved from in-flight uploads before submit)
 * 3. Schema validation provides less value for freeform chat input where
 *    either text OR attachments satisfy the "has content" requirement
 *
 * @see AdsChatInput for the react-hook-form pattern used in simpler chat inputs
 */
export function BrainstormInputView({
  input,
  onInputChange,
  attachments,
  onRemoveAttachment,
  onSubmit,
  onFilesAdd,
  isStreaming,
  isUploading,
  placeholder = DEFAULT_PLACEHOLDER,
  textareaRef: externalTextareaRef,
}: BrainstormInputViewProps) {
  const internalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = externalTextareaRef ?? internalTextareaRef;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent = input.trim() || attachments.length > 0;
  const canSubmit = hasContent && !isStreaming && !isUploading;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesAdd(files);
    }
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handleDrop = (files: FileList) => {
    onFilesAdd(files);
  };

  return (
    <div className="px-4 pb-8">
      <DropZone onDrop={handleDrop} disabled={isStreaming}>
        <div
          style={{ minHeight: "120px" }}
          className="bg-white border border-neutral-300 rounded-xl shadow-(--shadow-chat-default) hover:shadow-(--shadow-chat-delight) focus-within:shadow-(--shadow-chat-delight) transition-shadow p-4 flex flex-col max-w-3xl mx-auto"
        >
          {/* Attachment previews */}
          <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isStreaming}
            className="w-full resize-none border-0 bg-transparent text-sm placeholder:opacity-50 focus:outline-none focus:ring-0 flex-1 font-sans"
            style={{ color: "#74767a" }}
            rows={2}
            data-testid="chat-input"
          />
          <div className="flex items-center justify-between mt-auto pt-2">
            <button
              type="button"
              onClick={handleFileButtonClick}
              disabled={isStreaming}
              className="p-0 text-base-500 hover:opacity-70 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DocumentPlusIcon className="w-6 h-6" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary-500 text-white hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="send-button"
              aria-label={isStreaming || isUploading ? "Stop" : "Send message"}
            >
              {isStreaming || isUploading ? (
                <StopIcon className="w-4 h-4" strokeWidth={2} />
              ) : (
                <ArrowUpIcon className="w-4 h-4" strokeWidth={2} />
              )}
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={FILE_INPUT_ACCEPT}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </DropZone>
    </div>
  );
}

/**
 * Container component for brainstorm input.
 * Fetches data via hooks and delegates rendering to BrainstormInputView.
 * Supports file uploads via FilePlus button and drag & drop.
 *
 * Uses the SDK's composer API for unified text + attachment state management.
 */
export function BrainstormInput() {
  const { sendMessage } = useBrainstormSendMessage();
  const isStreaming = useBrainstormChatIsStreaming();
  const placeholderText = useBrainstormChatState("placeholderText"); // backend tells frontend what to show
  const composer = useBrainstormChatComposer();

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Register the textarea ref for external access (e.g., from BrainstormMessages)
  useEffect(() => {
    setTextareaRef(textareaRef);
  }, []);

  // Map composer attachments to the Attachment type expected by AttachmentList
  const attachments: Attachment[] = useMemo(
    () =>
      composer.attachments.map((a) => ({
        id: a.id,
        file: a.file!,
        status: a.status,
        type: a.file?.type.startsWith("image/") ? "image" : "document",
        url: a.url,
        errorMessage: a.errorMessage,
      })),
    [composer.attachments]
  );

  const onSubmit = useCallback(() => {
    if (composer.isReady) {
      // @ts-ignore -- composer handles attachments for us
      sendMessage(); // Sends composed content (text + attachments as inline URLs)
    }
  }, [composer.isReady, sendMessage]);

  const onFilesAdd = useCallback(
    (files: FileList) => {
      composer.addFiles(files);
    },
    [composer]
  );

  return (
    <BrainstormInputView
      input={composer.text}
      onInputChange={composer.setText}
      attachments={attachments}
      onRemoveAttachment={composer.removeAttachment}
      onSubmit={onSubmit}
      onFilesAdd={onFilesAdd}
      isStreaming={isStreaming}
      isUploading={composer.isUploading}
      placeholder={placeholderText || DEFAULT_PLACEHOLDER}
      textareaRef={textareaRef}
    />
  );
}
