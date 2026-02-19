import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectImages, useUploadProjectImage, useDeleteUpload, uploadsKeys } from "@api/uploads.hooks";
import { subscribeToAgentIntent } from "@context/AgentIntentContext";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.webp";
const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface ProjectImagesSectionProps {
  className?: string;
}

export function ProjectImagesSection({ className }: ProjectImagesSectionProps) {
  // Read directly from query - no store
  const { data: existingImages = [] } = useProjectImages();

  // Map to component's expected format
  const projectImages = existingImages.map((img) => ({
    uploadId: img.id,
    url: img.url,
    thumbUrl: img.thumb_url ?? undefined,
  }));

  // Mutations
  const uploadMutation = useUploadProjectImage();
  const deleteMutation = useDeleteUpload();

  // Refetch when the agent associates images via chat
  const queryClient = useQueryClient();
  subscribeToAgentIntent("images_associated", () => {
    queryClient.invalidateQueries({ queryKey: uploadsKeys.all });
  });

  // Local state for UI
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const canAddMore = projectImages.length + uploadingCount < MAX_IMAGES;
  const isUploading = uploadingCount > 0;
  const error = validationError ?? uploadMutation.error?.message ?? null;

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Invalid file type. Please use PNG, JPG, or WebP.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File too large. Maximum size is 10MB.";
    }
    return null;
  }, []);

  const handleUpload = useCallback(
    (file: File) => {
      if (!canAddMore) {
        setValidationError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }

      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }

      setValidationError(null);
      setUploadingCount((c) => c + 1);

      uploadMutation.mutate(
        { file },
        {
          onSettled: () => {
            setUploadingCount((c) => Math.max(0, c - 1));
          },
        }
      );
    },
    [canAddMore, validateFile, uploadMutation]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach((file) => handleUpload(file));
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
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => handleUpload(file));
    },
    [handleUpload]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleRemove = useCallback(
    async (uploadId: number) => {
      setDeletingIds((prev) => new Set([...prev, uploadId]));
      setValidationError(null);

      try {
        await deleteMutation.mutateAsync({ uploadId });
      } catch (err) {
        console.error("Project image delete failed:", err);
        setValidationError("Failed to remove image. Please try again.");
      } finally {
        setDeletingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(uploadId);
          return newSet;
        });
      }
    },
    [deleteMutation]
  );

  return (
    <div className={twMerge("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-base-500">Images</h3>
        <span className="text-xs text-base-300">
          {projectImages.length}/{MAX_IMAGES}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileSelect}
        multiple
        className="hidden"
        data-testid="project-images-input"
      />

      {/* Image grid */}
      {(projectImages.length > 0 || uploadingCount > 0) && (
        <div className="grid grid-cols-3 gap-2" data-testid="project-images-grid">
          {projectImages.map((image) => {
            const isImageDeleting = deletingIds.has(image.uploadId);
            return (
              <div
                key={image.uploadId}
                className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 group"
              >
                <img
                  src={image.thumbUrl || image.url}
                  alt="Project image"
                  crossOrigin="anonymous"
                  className={twMerge(
                    "w-full h-full object-cover",
                    isImageDeleting && "opacity-50"
                  )}
                />
                {isImageDeleting ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-base-400 animate-spin" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemove(image.uploadId)}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                    data-testid={`project-image-remove-${image.uploadId}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Upload placeholder slots */}
          {Array.from({ length: uploadingCount }).map((_, i) => (
            <div
              key={`uploading-${i}`}
              className="aspect-square rounded-lg border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center"
            >
              <Loader2 className="w-5 h-5 text-base-300 animate-spin" />
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {canAddMore && (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={twMerge(
            "w-full h-20 rounded-lg border border-dashed cursor-pointer transition-colors",
            "flex flex-col items-center justify-center gap-1",
            isDragging
              ? "border-primary-500 bg-primary-50"
              : "border-neutral-300 bg-white hover:border-neutral-400",
            isUploading && "pointer-events-none opacity-60"
          )}
          data-testid="project-images-upload-area"
        >
          <div className="w-6 h-6 rounded bg-neutral-100 flex items-center justify-center">
            <Upload className="w-3 h-3 text-base-500" />
          </div>
          <p className="text-xs text-base-400">Add project images</p>
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
