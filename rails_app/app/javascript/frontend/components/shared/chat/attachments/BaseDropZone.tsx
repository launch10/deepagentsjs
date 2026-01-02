import { useState, useCallback, type DragEvent, type ReactNode } from "react";
import { FolderIcon } from "@heroicons/react/24/outline";

interface BaseDropZoneProps {
  children: ReactNode;
  onDrop: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Base drop zone component for drag & drop file uploads.
 * Wraps children and shows an overlay when files are dragged over.
 * Used by the context-aware DropZone and for standalone usage.
 */
export function BaseDropZone({ children, onDrop, disabled = false, className }: BaseDropZoneProps) {
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
      className={className ?? "relative"}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Overlay when dragging files */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-[200px] bg-neutral-100/75">
          <div className="flex flex-col items-center gap-4">
            <FolderIcon className="w-40 h-40 text-primary-800" strokeWidth={1} />
            <div className="text-center">
              <h3 className="text-[28px] leading-8 font-semibold text-primary-800 font-serif">
                Add files
              </h3>
              <p className="text-lg text-primary-800 font-sans">
                Drop files here to add to the conversation
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
