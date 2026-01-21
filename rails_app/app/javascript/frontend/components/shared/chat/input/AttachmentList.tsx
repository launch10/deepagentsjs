import { useMemo } from "react";
import { useChatComposer } from "../ChatContext";
import { BaseAttachmentList } from "../attachments/BaseAttachmentList";
import { toDisplayAttachment, type ChatAttachment } from "../attachments/types";

export interface AttachmentListProps {
  /**
   * Optional className override.
   */
  className?: string;
  /**
   * Custom remove handler.
   * If not provided, uses composer.removeAttachment from context.
   */
  onRemove?: (id: string) => void;
}

/**
 * Chat.Input.AttachmentList - Context-aware attachment previews.
 *
 * Displays the current composer attachments with upload progress and remove buttons.
 * Automatically maps ComposerAttachments to display format.
 *
 * @example
 * ```tsx
 * <Chat.Root chat={chat}>
 *   <Chat.Input.AttachmentList className="mb-2" />
 *   <Chat.Input.Textarea placeholder="Type..." />
 * </Chat.Root>
 * ```
 */
export function AttachmentList({ className, onRemove }: AttachmentListProps) {
  const composer = useChatComposer()

  // Map composer attachments to display format
  const displayAttachments: ChatAttachment[] = useMemo(
    () => composer.attachments.map(toDisplayAttachment),
    [composer.attachments]
  );

  const handleRemove = (id: string) => {
    if (onRemove) {
      onRemove(id);
    } else {
      composer.removeAttachment(id);
    }
  };

  return (
    <BaseAttachmentList
      attachments={displayAttachments}
      onRemove={handleRemove}
      className={className}
    />
  );
}
