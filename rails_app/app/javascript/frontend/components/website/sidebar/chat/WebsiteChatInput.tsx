import { Chat } from "@components/shared/chat/Chat";
import { ArrowUp, FilePlus, Square } from "lucide-react";

export interface WebsiteChatInputProps {
  /** When true, the chat input is disabled */
  disabled?: boolean;
}

/**
 * Website chat input using Chat compound components.
 *
 * Uses context-aware components that automatically bind to the composer,
 * handle streaming state, and manage attachments. Submit behavior is
 * configured at Chat.Root level.
 *
 * Matches the same pattern as AdsChatInput for consistency.
 */
export default function WebsiteChatInput({ disabled = false }: WebsiteChatInputProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <Chat.Input.CreditGate>
        <Chat.Input.DropZone
          className="relative bg-white border border-neutral-300 rounded-2xl p-3 flex flex-col min-h-[80px]"
          data-testid="website-chat-dropzone"
        >
          <Chat.Input.AttachmentList className="flex flex-wrap gap-2 mb-2" />

          <Chat.Input.Textarea
            placeholder="Ask me for changes..."
            className="flex-1 text-xs min-h-[40px]"
            data-testid="website-chat-input"
            disabled={disabled}
          />

          <div className="flex items-center justify-between mt-auto pt-2">
            <Chat.Input.FileButton
              className="text-base-500 p-1 hover:bg-neutral-100 rounded"
              disabled={disabled}
            >
              <FilePlus className="size-4" />
            </Chat.Input.FileButton>

            <Chat.Input.SubmitButton
              stopIcon={<Square className="size-3" fill="currentColor" />}
              className="rounded-full bg-secondary-500 text-white hover:bg-secondary-600 size-6 flex items-center justify-center"
              data-testid="website-chat-submit"
              disabled={disabled}
            >
              <ArrowUp className="size-4" />
            </Chat.Input.SubmitButton>
          </div>
        </Chat.Input.DropZone>
      </Chat.Input.CreditGate>
    </div>
  );
}
