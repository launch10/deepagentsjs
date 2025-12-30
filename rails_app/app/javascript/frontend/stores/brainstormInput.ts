import { create } from "zustand";
import { useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  type Attachment,
  type AttachmentMediaType,
  generateAttachmentId,
  getMediaType,
  validateFile,
} from "~/types/attachment";
import { UploadService, type CreateUploadResponse } from "@api/uploads";
import type { RefObject } from "react";

/** Response shape from upload service */
export interface UploadResponse {
  id: number;
  url: string;
  thumb_url?: string;
  medium_url?: string;
}

export type BrainstormInputState = {
  input: string;
  attachments: Attachment[];
  isUploading: boolean;
};

export type BrainstormInputActions = {
  setInput: (text: string) => void;
  addFiles: (files: FileList | File[], jwt: string) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  getUploadIds: () => number[];
  reset: () => void;
};

export type BrainstormInputStore = BrainstormInputState & BrainstormInputActions;

// Module-level ref for textarea - refs should not be stored in zustand
let textareaRef: RefObject<HTMLTextAreaElement | null> = { current: null };

/**
 * Set the textarea ref. Call this from the BrainstormInput component.
 */
export function setTextareaRef(ref: RefObject<HTMLTextAreaElement | null>) {
  textareaRef = ref;
}

/**
 * Get the textarea ref for focus management.
 */
export function getTextareaRef(): RefObject<HTMLTextAreaElement | null> {
  return textareaRef;
}

/**
 * Singleton Zustand store for brainstorm input state.
 * Components subscribe directly with selectors for optimal re-renders.
 */
export const brainstormInputStore = create<BrainstormInputStore>()(
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

    const uploadFile = async (attachment: Attachment, jwt: string) => {
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
    };

    return {
      input: "",
      attachments: [],
      isUploading: false,

      setInput: (text) => {
        set({ input: text });
      },

      addFiles: (files, jwt) => {
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
          uploadFile(attachment, jwt);
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

/**
 * Hook to access brainstorm input state with selectors.
 * Only re-renders when the selected state changes.
 */
export function useBrainstormInputStore<T>(selector: (state: BrainstormInputStore) => T): T {
  return useStore(brainstormInputStore, selector);
}

// Selectors for fine-grained subscriptions
export const selectInput = (s: BrainstormInputStore) => s.input;
export const selectSetInput = (s: BrainstormInputStore) => s.setInput;
export const selectAttachments = (s: BrainstormInputStore) => s.attachments;
export const selectAddFiles = (s: BrainstormInputStore) => s.addFiles;
export const selectRemoveAttachment = (s: BrainstormInputStore) => s.removeAttachment;
export const selectClearAttachments = (s: BrainstormInputStore) => s.clearAttachments;
export const selectGetUploadIds = (s: BrainstormInputStore) => s.getUploadIds;
export const selectIsUploading = (s: BrainstormInputStore) => s.isUploading;
export const selectReset = (s: BrainstormInputStore) => s.reset;
