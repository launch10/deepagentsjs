import type { Attachment } from "~/types/attachment";
import { ImageThumbnail } from "./ImageThumbnail";
import { FilePill } from "./FilePill";

interface AttachmentListProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

/**
 * Renders a row of attachment previews above the input area.
 * Handles both image thumbnails and file pills.
 */
export function AttachmentList({ attachments, onRemove }: AttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-3">
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
