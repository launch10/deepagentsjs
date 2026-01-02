import type { ComposerAttachment } from "langgraph-ai-sdk-types";

/**
 * Type for attachments in the chat UI.
 * Maps from ComposerAttachment to include additional display info.
 */
export interface ChatAttachment {
  id: string;
  file?: File;
  status: "uploading" | "completed" | "error";
  type: "image" | "document";
  previewUrl?: string;
  url?: string;
  errorMessage?: string;
}

/**
 * Convert ComposerAttachment to ChatAttachment for display.
 */
export function toDisplayAttachment(attachment: ComposerAttachment): ChatAttachment {
  return {
    id: attachment.id,
    file: attachment.file,
    status: attachment.status,
    type: attachment.file?.type.startsWith("image/") ? "image" : "document",
    previewUrl: attachment.previewUrl,
    url: attachment.url,
    errorMessage: attachment.errorMessage,
  };
}
