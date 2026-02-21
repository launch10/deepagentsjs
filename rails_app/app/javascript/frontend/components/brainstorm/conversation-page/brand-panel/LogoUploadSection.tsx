import { useState, useRef, useCallback } from "react";
import { Upload, X, RefreshCw, Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectLogo, useUploadLogo, useDeleteUpload, uploadsKeys } from "@api/uploads.hooks";
import { subscribeToAgentIntent } from "@hooks/useAgentIntent";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.svg";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface LogoUploadSectionProps {
  className?: string;
}

export function LogoUploadSection({ className }: LogoUploadSectionProps) {
  // Read directly from query - no store
  const { data: existingLogos = [] } = useProjectLogo();
  const logo = existingLogos[0] ?? null;

  // Mutations provide their own loading state
  const uploadMutation = useUploadLogo();
  const deleteMutation = useDeleteUpload();

  // Refetch when the agent sets the logo via chat
  const queryClient = useQueryClient();
  subscribeToAgentIntent("logo_set", () => {
    queryClient.invalidateQueries({ queryKey: uploadsKeys.all });
  });

  // Local state for UI
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const error =
    validationError ?? uploadMutation.error?.message ?? deleteMutation.error?.message ?? null;

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Invalid file type. Please use PNG, JPG, or SVG.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File too large. Maximum size is 5MB.";
    }
    return null;
  }, []);

  const handleUpload = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }
      setValidationError(null);
      uploadMutation.mutate({ file });
    },
    [validateFile, uploadMutation]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
      // Reset input to allow re-selecting same file
      e.target.value = "";
    },
    [handleUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!logo) return;
      setValidationError(null);
      deleteMutation.mutate({ uploadId: logo.id });
    },
    [logo, deleteMutation]
  );

  const handleReplace = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    inputRef.current?.click();
  }, []);

  return (
    <div className={twMerge("space-y-2", className)}>
      <h3 className="text-sm font-semibold text-base-500">Logo</h3>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileSelect}
        className="hidden"
        data-testid="logo-file-input"
      />

      {logo ? (
        // Preview mode with uploaded logo
        <div
          className="relative w-full h-[104px] rounded-lg border border-neutral-300 bg-white overflow-hidden"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          data-testid="logo-preview"
        >
          <img
            src={logo.thumb_url || logo.url}
            alt="Brand logo"
            className="w-full h-full object-contain p-2"
            crossOrigin="anonymous"
          />

          {/* Hover overlay with actions */}
          {isHovering && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleReplace}
                className="flex items-center gap-1 px-3 py-1.5 bg-white text-base-500 rounded-md text-xs font-medium hover:bg-neutral-100 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={isDeleting}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-md text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                data-testid="logo-remove-button"
              >
                {isDeleting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                {isDeleting ? "Removing..." : "Remove"}
              </button>
            </div>
          )}
        </div>
      ) : (
        // Upload area
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={twMerge(
            "w-full h-[104px] rounded-lg border border-dashed cursor-pointer transition-colors",
            "flex flex-col items-center justify-center gap-2",
            isDragging
              ? "border-primary-500 bg-primary-50"
              : "border-neutral-300 bg-white hover:border-neutral-400",
            isUploading && "pointer-events-none opacity-60"
          )}
          data-testid="logo-upload-area"
        >
          {isUploading ? (
            <div data-testid="logo-upload-loading">
              <Loader2 className="w-7 h-7 text-base-400 animate-spin" />
            </div>
          ) : (
            <>
              <div className="w-7 h-7 rounded bg-neutral-100 flex items-center justify-center">
                <Upload className="w-4 h-4 text-base-500" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-base-500">Add your logo here</p>
                <p className="text-xs text-base-300">PNG, JPG or SVG</p>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
