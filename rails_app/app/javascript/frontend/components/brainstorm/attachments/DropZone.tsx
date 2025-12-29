import { useState, useCallback, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";

interface DropZoneProps {
  children: ReactNode;
  onDrop: (files: FileList) => void;
  disabled?: boolean;
}

/**
 * Drop zone overlay for drag & drop file uploads.
 * Wraps the chat area and shows an overlay when files are dragged over.
 */
export function DropZone({ children, onDrop, disabled = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && e.dataTransfer.types.includes("Files")) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the dropzone entirely
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onDrop(files);
      }
    },
    [disabled, onDrop]
  );

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Overlay when dragging files */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 rounded-xl border-2 border-dashed border-secondary-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-secondary-100 flex items-center justify-center">
              <Upload className="w-8 h-8 text-secondary-500" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-base-500 font-sans">
                Add files
              </h3>
              <p className="text-sm text-base-400 font-sans">
                Drop images or PDFs here
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
