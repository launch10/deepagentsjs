import type { ChatAttachment } from "./types";
import { ImageThumbnail } from "./ImageThumbnail";
import { FilePill } from "./FilePill";

interface BaseAttachmentListProps {
  attachments: ChatAttachment[];
  onRemove: (id: string) => void;
  className?: string;
}

/**
 * Base attachment list component - renders a row of attachment previews.
 * Used by both the context-aware AttachmentList and for standalone usage.
 */
export function BaseAttachmentList({ attachments, onRemove, className }: BaseAttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={className ?? "flex flex-wrap gap-2 mb-3"} data-testid="attachment-list">
      {attachments.map((attachment) =>
        attachment.type === "image" ? (
          <ImageThumbnail
            key={attachment.id}
            attachment={attachment}
            onRemove={onRemove}
          />
        ) : (
          <FilePill
            key={attachment.id}
            attachment={attachment}
            onRemove={onRemove}
          />
        )
      )}
    </div>
  );
}
