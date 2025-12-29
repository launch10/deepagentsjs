import { X, Image as ImageIcon, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import type { Attachment } from "~/types/attachment";

interface ImageThumbnailProps {
  attachment: Attachment;
  onRemove: (id: string) => void;
}

/**
 * Image thumbnail component for brainstorm attachments.
 * Shows loading spinner while uploading, X button when complete, or error state.
 *
 * Sizes: 110x104px, rounded-lg (8px)
 */
export function ImageThumbnail({ attachment, onRemove }: ImageThumbnailProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    // Create object URL for preview before upload completes
    const url = URL.createObjectURL(attachment.file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [attachment.file]);

  const isUploading = attachment.status === "uploading";
  const hasError = attachment.status === "error";

  return (
    <div
      className={`relative w-[110px] h-[104px] rounded-lg overflow-hidden flex-shrink-0 ${
        hasError ? "border-2 border-error-300" : "border border-neutral-300"
      }`}
      style={{ backgroundColor: "#EDEDEC" }}
    >
      {/* Image preview */}
      {previewUrl && (
        <img
          src={previewUrl}
          alt={attachment.file.name}
          className="w-full h-full object-cover"
        />
      )}

      {/* Overlay for loading/error states */}
      {(isUploading || hasError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          {isUploading && (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          )}
          {hasError && (
            <AlertTriangle className="w-6 h-6 text-error-500" />
          )}
        </div>
      )}

      {/* X button - only show when not uploading */}
      {!isUploading && (
        <button
          type="button"
          onClick={() => onRemove(attachment.id)}
          className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-neutral-100 transition-colors"
          aria-label="Remove attachment"
        >
          <X className="w-3 h-3 text-base-500" strokeWidth={2} />
        </button>
      )}

      {/* Image icon indicator at bottom left when completed */}
      {attachment.status === "completed" && (
        <div className="absolute bottom-1.5 left-1.5 w-4 h-4 flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-white drop-shadow-sm" strokeWidth={2} />
        </div>
      )}
    </div>
  );
}
