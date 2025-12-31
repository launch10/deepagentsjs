import { X, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import type { Attachment } from "~/types/attachment";

interface ImageThumbnailProps {
  attachment: Attachment;
  onRemove: (id: string) => void;
}

/**
 * Spinner component matching Figma design - simple arc spinner
 */
function LoadingSpinner() {
  return (
    <svg
      className="w-6 h-6 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="#D3D2D0"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 2C6.47715 2 2 6.47715 2 12"
        stroke="#5867C4"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
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
  const isComplete = attachment.status === "completed";

  return (
    <div
      className={`relative w-[110px] h-[104px] rounded-lg overflow-hidden flex-shrink-0 ${
        hasError ? "border-2 border-error-300" : "border border-neutral-100"
      }`}
      style={{ backgroundColor: "#EDEDEC" }}
      data-testid="attachment-item"
      data-status={attachment.status}
    >
      {/* Image preview - only show when upload is complete */}
      {previewUrl && isComplete && (
        <img
          src={previewUrl}
          alt={attachment.file.name}
          className="w-full h-full object-cover"
        />
      )}

      {/* Loading spinner - centered on gray background */}
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-error-500" />
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
      {isComplete && (
        <div className="absolute bottom-1.5 left-1.5 w-4 h-4 flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-white drop-shadow-sm" strokeWidth={2} />
        </div>
      )}
    </div>
  );
}
