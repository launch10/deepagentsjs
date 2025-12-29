import { createContext, useContext, useState, useRef, useCallback, type RefObject } from "react";
import {
  type Attachment,
  generateAttachmentId,
  getMediaType,
  validateFile,
} from "~/types/attachment";
import { UploadService, type CreateUploadResponse } from "@api/uploads";
import { usePage } from "@inertiajs/react";

interface BrainstormInputContextType {
  input: string;
  setInput: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Current file attachments */
  attachments: Attachment[];
  /** Add file(s) and start uploading immediately */
  addFiles: (files: FileList | File[]) => void;
  /** Remove an attachment by its client ID */
  removeAttachment: (id: string) => void;
  /** Clear all attachments */
  clearAttachments: () => void;
  /** Get IDs of completed uploads for sending with message */
  getUploadIds: () => number[];
  /** Whether any attachments are currently uploading */
  isUploading: boolean;
}

const BrainstormInputContext = createContext<BrainstormInputContextType | null>(null);

/**
 * Provider for local input state and file attachments.
 * Shared between BrainstormInput and components that need to set input (example clicks, command buttons).
 */
export function BrainstormInputProvider({ children }: { children: React.ReactNode }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const { jwt } = usePage<{ jwt: string }>().props;

  const isUploading = attachments.some((a) => a.status === "uploading");

  const updateAttachment = useCallback((id: string, updates: Partial<Attachment>) => {
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, []);

  const uploadFile = useCallback(
    async (attachment: Attachment) => {
      try {
        const uploadService = new UploadService({ jwt });
        const response: CreateUploadResponse = await uploadService.create({
          "upload[file]": attachment.file,
          "upload[is_logo]": false,
        });

        updateAttachment(attachment.id, {
          status: "completed",
          uploadId: response.id,
          url: response.url,
          thumbUrl: response.thumb_url ?? undefined,
          mediumUrl: response.medium_url ?? undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        updateAttachment(attachment.id, {
          status: "error",
          errorMessage: message,
        });
      }
    },
    [jwt, updateAttachment]
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      const newAttachments: Attachment[] = [];

      for (const file of fileArray) {
        const validationError = validateFile(file);
        const mediaType = getMediaType(file);

        if (validationError || !mediaType) {
          // Create failed attachment for error display
          newAttachments.push({
            id: generateAttachmentId(),
            file,
            status: "error",
            type: mediaType || "image",
            errorMessage: validationError || "Unknown file type",
          });
          continue;
        }

        const attachment: Attachment = {
          id: generateAttachmentId(),
          file,
          status: "uploading",
          type: mediaType,
        };

        newAttachments.push(attachment);

        // Start upload immediately
        uploadFile(attachment);
      }

      setAttachments((prev) => [...prev, ...newAttachments]);
    },
    [uploadFile]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const getUploadIds = useCallback((): number[] => {
    return attachments.filter((a) => a.status === "completed" && a.uploadId).map((a) => a.uploadId!);
  }, [attachments]);

  return (
    <BrainstormInputContext.Provider
      value={{
        input,
        setInput,
        textareaRef,
        attachments,
        addFiles,
        removeAttachment,
        clearAttachments,
        getUploadIds,
        isUploading,
      }}
    >
      {children}
    </BrainstormInputContext.Provider>
  );
}

/**
 * Hook to access input state and setter.
 */
export function useBrainstormInput() {
  const context = useContext(BrainstormInputContext);
  if (!context) {
    throw new Error("useBrainstormInput must be used within BrainstormInputProvider");
  }
  return context;
}
