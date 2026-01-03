import { X, FileText, Loader2 } from "lucide-react";
import type { ChatAttachment } from "./types";

interface FilePillProps {
  attachment: ChatAttachment;
  onRemove: (id: string) => void;
}

/**
 * File pill component for non-image attachments (PDFs).
 * Shows loading spinner while uploading, filename + X button when complete.
 */
export function FilePill({ attachment, onRemove }: FilePillProps) {
  const isUploading = attachment.status === "uploading";
  const hasError = attachment.status === "error";

  // Truncate filename if too long
  const maxLength = 20;
  const filename = attachment.file?.name ?? "Unknown file";
  const displayName =
    filename.length > maxLength
      ? `${filename.slice(0, maxLength - 3)}...`
      : filename;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-full flex-shrink-0 ${
        hasError
          ? "bg-error-50 border border-error-300"
          : "bg-neutral-100 border border-neutral-300"
      }`}
      data-testid="attachment-item"
      data-status={attachment.status}
    >
      {/* Icon or spinner */}
      {isUploading ? (
        <Loader2 className="w-4 h-4 text-base-400 animate-spin flex-shrink-0" />
      ) : (
        <FileText className="w-4 h-4 text-base-500 flex-shrink-0" strokeWidth={2} />
      )}

      {/* Filename */}
      <span
        className={`text-sm font-sans ${hasError ? "text-error-500" : "text-base-500"}`}
        title={filename}
      >
        {displayName}
      </span>

      {/* X button - only show when not uploading */}
      {!isUploading && (
        <button
          type="button"
          onClick={() => onRemove(attachment.id)}
          className="w-4 h-4 flex items-center justify-center hover:text-error-500 transition-colors flex-shrink-0"
          aria-label="Remove attachment"
        >
          <X className="w-3.5 h-3.5 text-base-400" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
