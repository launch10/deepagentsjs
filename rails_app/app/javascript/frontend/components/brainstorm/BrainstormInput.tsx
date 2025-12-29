import { useRef } from "react";
import { useBrainstormChatActions, useBrainstormChatIsStreaming } from "@hooks/useBrainstormChat";
import { useBrainstormInput } from "./BrainstormInputContext";
import { DocumentPlusIcon, ArrowUpIcon, StopIcon } from "@heroicons/react/24/outline";
import { AttachmentList, DropZone } from "./attachments";
import { FILE_INPUT_ACCEPT } from "~/types/attachment";

/**
 * Brainstorm input area.
 * Uses context for input state, hooks for SDK actions.
 * Supports file uploads via FilePlus button and drag & drop.
 */
export function BrainstormInput() {
  const { sendMessage } = useBrainstormChatActions();
  const isStreaming = useBrainstormChatIsStreaming();
  const {
    input,
    setInput,
    textareaRef,
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    getUploadIds,
    isUploading,
  } = useBrainstormInput();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasContent = input.trim() || attachments.length > 0;
  const canSubmit = hasContent && !isStreaming && !isUploading;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const uploadIds = getUploadIds();
    const message = input.trim();

    // Send message with uploadIds if any
    if (message || uploadIds.length > 0) {
      sendMessage(message, { uploadIds });
      setInput("");
      clearAttachments();
    }
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
      addFiles(files);
    }
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handleDrop = (files: FileList) => {
    addFiles(files);
  };

  return (
    <div className="px-4 pb-4">
      <DropZone onDrop={handleDrop} disabled={isStreaming}>
        <div
          style={{ maxWidth: "808px", minHeight: "120px" }}
          className="bg-white border border-neutral-300 rounded-xl shadow-[0px_0px_8px_4px_rgba(167,165,161,0.08)] p-4 mx-auto flex flex-col"
        >
          {/* Attachment previews */}
          <AttachmentList attachments={attachments} onRemove={removeAttachment} />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='e.g. "FreshFund is a budgeting tool that helps freelancers track income and expenses."'
            disabled={isStreaming}
            className="w-full resize-none border-0 bg-transparent text-sm placeholder:opacity-50 focus:outline-none flex-1 font-sans"
            style={{ color: "#74767a" }}
            rows={2}
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
      {/* Help links */}
      <div className="flex items-center justify-center gap-2 mt-4 text-sm text-base-400 font-sans">
        <button className="hover:underline">See examples of answers</button>
        <span className="opacity-70">•</span>
        <button className="hover:underline">Learn how it works</button>
      </div>
    </div>
  );
}
