import { FileText } from "lucide-react";
import type { FileMessageBlock } from "langgraph-ai-sdk-types";

interface MessageDocumentsProps {
  files: FileMessageBlock[];
}

/**
 * Displays documents (PDFs, etc.) that were sent with a message.
 * Simpler than input attachments - no upload state, just display.
 */
export function MessageDocuments({ files }: MessageDocumentsProps) {
  if (files.length === 0) {
    return null;
  }

  // Helper to get filename from URL
  const getFilename = (url: string): string => {
    try {
      const pathname = new URL(url).pathname;
      const filename = pathname.split("/").pop() || "document";
      // Decode URI and truncate if needed
      const decoded = decodeURIComponent(filename);
      const maxLength = 25;
      if (decoded.length > maxLength) {
        return `${decoded.slice(0, maxLength - 3)}...`;
      }
      return decoded;
    } catch {
      return "document";
    }
  };

  // Helper to get display name for mime type
  const getMimeLabel = (mimeType: string): string => {
    if (mimeType === "application/pdf") return "PDF";
    if (mimeType.startsWith("application/")) return mimeType.replace("application/", "").toUpperCase();
    return "File";
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2" data-testid="message-documents">
      {files.map((file) => (
        <a
          key={file.id}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 transition-colors max-w-[200px]"
          data-testid="message-document"
          data-mime-type={file.mimeType}
        >
          <FileText className="w-5 h-5 text-base-500 flex-shrink-0" strokeWidth={2} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-neutral-900 truncate">
              {getFilename(file.url)}
            </span>
            <span className="text-xs text-neutral-500">
              {getMimeLabel(file.mimeType)}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
