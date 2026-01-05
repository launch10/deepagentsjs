/**
 * File attachment types for brainstorm chat uploads.
 * Supports images and PDFs with immediate upload behavior.
 */

/** Allowed MIME types for uploads */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

export const ALLOWED_DOCUMENT_TYPES = ["application/pdf"] as const;

export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES] as const;

/** File size limits in bytes */
export const FILE_SIZE_LIMITS = {
  image: 100 * 1024 * 1024, // 100MB
  document: 50 * 1024 * 1024, // 50MB
} as const;

/** Accept string for file input */
export const FILE_INPUT_ACCEPT = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
].join(",");

/** Attachment media type - matches backend Upload.media_type */
export type AttachmentMediaType = "image" | "document";

/** Attachment upload status */
export type AttachmentStatus = "uploading" | "completed" | "error";

/**
 * Represents a file attachment in the brainstorm chat.
 * Tracks the upload lifecycle from selection through completion.
 */
export interface Attachment {
  /** Temporary client-side ID for tracking before upload completes */
  id: string;
  /** Rails Upload ID after successful upload */
  uploadId?: number;
  /** The original File object */
  file: File;
  /** Current upload status */
  status: AttachmentStatus;
  /** Media type (image or document) */
  type: AttachmentMediaType;
  /** Full-size URL after upload (for images) */
  url?: string;
  /** Thumbnail URL after upload (for images only) */
  thumbUrl?: string;
  /** Medium URL after upload (for images only) */
  mediumUrl?: string;
  /** Error message if upload failed */
  errorMessage?: string;
  /** Upload progress (0-100) */
  progress?: number;
}

/**
 * Validates if a file type is allowed for upload.
 */
export function isAllowedFileType(file: File): boolean {
  return (ALLOWED_FILE_TYPES as readonly string[]).includes(file.type);
}

/**
 * Determines the media type for a file.
 */
export function getMediaType(file: File): AttachmentMediaType | null {
  if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "image";
  }
  if ((ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
    return "document";
  }
  return null;
}

/**
 * Validates file size against limits.
 */
export function isFileSizeValid(file: File): boolean {
  const mediaType = getMediaType(file);
  if (!mediaType) return false;
  return file.size <= FILE_SIZE_LIMITS[mediaType];
}

/**
 * Gets the file size limit for a given media type.
 */
export function getFileSizeLimit(mediaType: AttachmentMediaType): number {
  return FILE_SIZE_LIMITS[mediaType];
}

/**
 * Formats a file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates a file for upload and returns an error message if invalid.
 */
export function validateFile(file: File): string | null {
  if (!isAllowedFileType(file)) {
    return `File type "${file.type || "unknown"}" is not supported. Allowed: images (JPEG, PNG, GIF, WebP, SVG) and PDFs.`;
  }

  const mediaType = getMediaType(file);
  if (mediaType && !isFileSizeValid(file)) {
    const limit = formatFileSize(FILE_SIZE_LIMITS[mediaType]);
    return `File is too large. ${mediaType === "image" ? "Images" : "PDFs"} must be under ${limit}.`;
  }

  return null;
}

/**
 * Generates a unique client-side ID for an attachment.
 */
export function generateAttachmentId(): string {
  return `attachment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
