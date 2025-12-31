import { useRef, useEffect } from "react";
import { useBrainstormChatState } from "@hooks/useBrainstormChat";
import { Chat } from "@components/chat";
import { setTextareaRef } from "@lib/brainstormTextarea";
import { DocumentPlusIcon, ArrowUpIcon, StopIcon } from "@heroicons/react/24/outline";

/**
 * Default placeholder text for the input.
 */
const DEFAULT_PLACEHOLDER = 'e.g. "FreshFund is a budgeting tool that helps freelancers track income and expenses."';

/**
 * Brainstorm chat input using Chat compound components.
 *
 * Uses context-aware components that automatically bind to the composer,
 * handle streaming state, and manage attachments. Submit behavior (including
 * workflow sync) is configured at Chat.Root level via onSubmit prop.
 *
 * The only brainstorm-specific pieces here are:
 * - placeholderText: dynamic placeholder from backend
 * - setTextareaRef: for external focus management (e.g., suggestion clicks)
 */
export function BrainstormInput() {
  const placeholderText = useBrainstormChatState("placeholderText");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Register textarea ref for external focus management
  useEffect(() => {
    setTextareaRef(textareaRef);
  }, []);

  return (
    <div className="px-4 pb-8">
      <Chat.Input.DropZone className="relative bg-white border border-neutral-300 rounded-xl shadow-(--shadow-chat-default) hover:shadow-(--shadow-chat-delight) focus-within:shadow-(--shadow-chat-delight) transition-shadow p-4 flex flex-col max-w-3xl mx-auto min-h-[120px]">
        <Chat.Input.AttachmentList className="flex flex-wrap gap-2 mb-3" />

        <Chat.Input.Textarea
          ref={textareaRef}
          placeholder={placeholderText || DEFAULT_PLACEHOLDER}
          className="flex-1"
          style={{ color: "#74767a" }}
        />

        <div className="flex items-center justify-between mt-auto pt-2">
          <Chat.Input.FileButton className="text-base-500">
            <DocumentPlusIcon className="w-6 h-6" strokeWidth={1.5} />
          </Chat.Input.FileButton>

          <Chat.Input.SubmitButton
            stopIcon={<StopIcon className="w-4 h-4" strokeWidth={2} />}
            className="w-6 h-6 rounded-full bg-secondary-500 text-white hover:bg-secondary-600"
          >
            <ArrowUpIcon className="w-4 h-4" strokeWidth={2} />
          </Chat.Input.SubmitButton>
        </div>
      </Chat.Input.DropZone>
    </div>
  );
}
