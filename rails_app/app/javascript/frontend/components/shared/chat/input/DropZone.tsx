import type { ReactNode } from "react";
import { useChatContext } from "../ChatContext";
import { BaseDropZone } from "../attachments/BaseDropZone";

export interface DropZoneProps {
  children: ReactNode;
  /**
   * Custom handler for dropped files.
   * If not provided, uses composer.addFiles from context.
   */
  onDrop?: (files: FileList) => void;
  /**
   * Override disabled state.
   * Defaults to isStreaming from context.
   */
  disabled?: boolean;
  /**
   * Optional className for the container.
   */
  className?: string;
}

/**
 * Chat.Input.DropZone - Context-aware drag & drop zone.
 *
 * Wraps children and shows an overlay when files are dragged over.
 * Automatically adds dropped files to the composer and disables during streaming.
 *
 * @example
 * ```tsx
 * <Chat.Root chat={chat}>
 *   <Chat.Input.DropZone className="rounded-xl shadow-chat p-4">
 *     <Chat.Input.AttachmentList />
 *     <Chat.Input.Textarea placeholder="Type..." />
 *     <Chat.Input.SubmitButton>Send</Chat.Input.SubmitButton>
 *   </Chat.Input.DropZone>
 * </Chat.Root>
 * ```
 */
export function DropZone({ children, onDrop, disabled, className }: DropZoneProps) {
  const { composer, isStreaming } = useChatContext();

  const handleDrop = (files: FileList) => {
    if (onDrop) {
      onDrop(files);
    } else {
      composer.addFiles(files);
    }
  };

  return (
    <BaseDropZone onDrop={handleDrop} disabled={disabled ?? isStreaming} className={className}>
      {children}
    </BaseDropZone>
  );
}
