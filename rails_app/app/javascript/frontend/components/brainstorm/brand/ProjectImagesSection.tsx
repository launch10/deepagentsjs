import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { usePage } from "@inertiajs/react";
import {
  useBrandPersonalizationStore,
  uploadProjectImage as uploadProjectImageApi,
  deleteProjectImage as deleteProjectImageApi,
  selectProjectImages,
  selectUploadingImageIds,
  selectError,
} from "@stores/brandPersonalization";
import { useProjectImages } from "@api/uploads.hooks";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.webp";
const MAX_IMAGES = 10;

interface ProjectImagesSectionProps {
  className?: string;
}

export function ProjectImagesSection({ className }: ProjectImagesSectionProps) {
  const { jwt, website } = usePage<{ jwt: string; website?: { id: number } }>().props;

  const projectImages = useBrandPersonalizationStore(selectProjectImages);
  const uploadingIds = useBrandPersonalizationStore(selectUploadingImageIds);
  const error = useBrandPersonalizationStore(selectError);

  const addProjectImage = useBrandPersonalizationStore((s) => s.addProjectImage);
  const setProjectImages = useBrandPersonalizationStore((s) => s.setProjectImages);
  const removeProjectImage = useBrandPersonalizationStore((s) => s.removeProjectImage);
  const addUploadingImageId = useBrandPersonalizationStore((s) => s.addUploadingImageId);
  const removeUploadingImageId = useBrandPersonalizationStore((s) => s.removeUploadingImageId);
  const setError = useBrandPersonalizationStore((s) => s.setError);

  const [isDragging, setIsDragging] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch existing images from API
  const { data: existingImages } = useProjectImages();

  // Initialize store with existing images
  useEffect(() => {
    if (existingImages && existingImages.length > 0 && !hasInitialized) {
      setProjectImages(
        existingImages.map((img) => ({
          uploadId: img.id,
          url: img.url,
          thumbUrl: img.thumb_url ?? undefined,
        }))
      );
      setHasInitialized(true);
    }
  }, [existingImages, hasInitialized, setProjectImages]);

  const canAddMore = projectImages.length < MAX_IMAGES;
  const isUploading = uploadingIds.size > 0;

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Invalid file type. Please use PNG, JPG, or WebP.";
    }
    if (file.size > 10 * 1024 * 1024) {
      return "File too large. Maximum size is 10MB.";
    }
    return null;
  };

  const handleUpload = useCallback(
    async (file: File) => {
      if (!canAddMore) {
        setError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setError(null);
      addUploadingImageId(tempId);

      try {
        const uploadedImage = await uploadProjectImageApi(file, tempId, jwt, website?.id);
        addProjectImage(uploadedImage);
      } catch (err) {
        console.error("Project image upload failed:", err);
        setError("Upload failed. Please try again.");
      } finally {
        removeUploadingImageId(tempId);
      }
    },
    [
      canAddMore,
      jwt,
      website?.id,
      addProjectImage,
      setError,
      addUploadingImageId,
      removeUploadingImageId,
    ]
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
      setError(null);

      try {
        await deleteProjectImageApi(uploadId, jwt);
        removeProjectImage(uploadId);
      } catch (err) {
        console.error("Project image delete failed:", err);
        setError("Failed to remove image. Please try again.");
      } finally {
        setDeletingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(uploadId);
          return newSet;
        });
      }
    },
    [jwt, removeProjectImage, setError]
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
      {projectImages.length > 0 && (
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
          {Array.from(uploadingIds).map((id) => (
            <div
              key={id}
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
