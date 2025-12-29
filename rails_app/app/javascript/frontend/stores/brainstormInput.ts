import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  type Attachment,
  type AttachmentMediaType,
  generateAttachmentId,
  getMediaType,
  validateFile,
} from "~/types/attachment";

/** Response shape from upload service */
export interface UploadResponse {
  id: number;
  url: string;
  thumb_url?: string;
  medium_url?: string;
}

/** Function signature for uploading files */
export type UploadFn = (attachment: Attachment) => Promise<UploadResponse>;

export type BrainstormInputState = {
  input: string;
  attachments: Attachment[];
  isUploading: boolean;
};

export type BrainstormInputActions = {
  setInput: (text: string) => void;
  addFiles: (files: FileList | File[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  getUploadIds: () => number[];
  reset: () => void;
};

export type BrainstormInputStore = BrainstormInputState & BrainstormInputActions;

interface CreateStoreOptions {
  uploadFn: UploadFn;
}

export const createBrainstormInputStore = ({ uploadFn }: CreateStoreOptions) => {
  return createStore<BrainstormInputStore>()(
    subscribeWithSelector((set, get) => {
      const updateAttachment = (id: string, updates: Partial<Attachment>) => {
        set((state) => {
          const newAttachments = state.attachments.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          );
          const isUploading = newAttachments.some((a) => a.status === "uploading");
          return { attachments: newAttachments, isUploading };
        });
      };

      const uploadFile = async (attachment: Attachment) => {
        try {
          const response = await uploadFn(attachment);
          updateAttachment(attachment.id, {
            status: "completed",
            uploadId: response.id,
            url: response.url,
            thumbUrl: response.thumb_url,
            mediumUrl: response.medium_url,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          updateAttachment(attachment.id, {
            status: "error",
            errorMessage: message,
          });
        }
      };

      return {
        input: "",
        attachments: [],
        isUploading: false,

        setInput: (text) => {
          set({ input: text });
        },

        addFiles: (files) => {
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
                type: (mediaType || "image") as AttachmentMediaType,
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

            // Start upload immediately (don't await - let it run in background)
            uploadFile(attachment);
          }

          set((state) => ({
            attachments: [...state.attachments, ...newAttachments],
            isUploading:
              state.isUploading || newAttachments.some((a) => a.status === "uploading"),
          }));
        },

        removeAttachment: (id) => {
          set((state) => {
            const newAttachments = state.attachments.filter((a) => a.id !== id);
            const isUploading = newAttachments.some((a) => a.status === "uploading");
            return { attachments: newAttachments, isUploading };
          });
        },

        clearAttachments: () => {
          set({ attachments: [], isUploading: false });
        },

        getUploadIds: () => {
          return get()
            .attachments.filter((a) => a.status === "completed" && a.uploadId != null)
            .map((a) => a.uploadId!);
        },

        reset: () => {
          set({ input: "", attachments: [], isUploading: false });
        },
      };
    })
  );
};
