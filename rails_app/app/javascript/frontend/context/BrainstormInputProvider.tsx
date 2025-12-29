import { createContext, useContext, useState, useRef, useCallback, type RefObject, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";
import { usePage } from "@inertiajs/react";
import { createBrainstormInputStore, type BrainstormInputStore, type UploadResponse } from "@stores/brainstormInput";
import { UploadService, type CreateUploadResponse } from "@api/uploads";
import type { Attachment } from "~/types/attachment";

type BrainstormInputStoreApi = StoreApi<BrainstormInputStore>;

interface BrainstormInputContextType {
  store: BrainstormInputStoreApi;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

const BrainstormInputContext = createContext<BrainstormInputContextType | null>(null);

interface BrainstormInputProviderProps {
  children: ReactNode;
}

/**
 * Provider for brainstorm input state and file attachments.
 * Uses a zustand store for reactive state with selector-based subscriptions.
 * The textareaRef is kept in React context (refs shouldn't be in zustand).
 */
export function BrainstormInputProvider({ children }: BrainstormInputProviderProps) {
  const { jwt } = usePage<{ jwt: string }>().props;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Create upload function that uses the UploadService
  const uploadFn = useCallback(
    async (attachment: Attachment): Promise<UploadResponse> => {
      const uploadService = new UploadService({ jwt });
      const response: CreateUploadResponse = await uploadService.create({
        "upload[file]": attachment.file,
        "upload[is_logo]": false,
      });

      return {
        id: response.id,
        url: response.url,
        thumb_url: response.thumb_url ?? undefined,
        medium_url: response.medium_url ?? undefined,
      };
    },
    [jwt]
  );

  // Create store once (stable reference)
  const [store] = useState(() => createBrainstormInputStore({ uploadFn }));

  return (
    <BrainstormInputContext.Provider value={{ store, textareaRef }}>
      {children}
    </BrainstormInputContext.Provider>
  );
}

/**
 * Hook to access brainstorm input state with selectors.
 * Only re-renders when the selected state changes.
 */
export function useBrainstormInputStore<T>(selector: (state: BrainstormInputStore) => T): T {
  const context = useContext(BrainstormInputContext);
  if (!context) {
    throw new Error("useBrainstormInputStore must be used within BrainstormInputProvider");
  }
  return useStore(context.store, selector);
}

/**
 * Hook to access the textarea ref for focus management.
 */
export function useBrainstormTextareaRef(): RefObject<HTMLTextAreaElement | null> {
  const context = useContext(BrainstormInputContext);
  if (!context) {
    throw new Error("useBrainstormTextareaRef must be used within BrainstormInputProvider");
  }
  return context.textareaRef;
}

/**
 * Convenience hook that returns all input state and actions.
 * For components that need everything. For selective subscriptions, use useBrainstormInputStore.
 */
export function useBrainstormInput() {
  const context = useContext(BrainstormInputContext);
  if (!context) {
    throw new Error("useBrainstormInput must be used within BrainstormInputProvider");
  }

  const state = useStore(context.store);

  return {
    ...state,
    textareaRef: context.textareaRef,
  };
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

export { type BrainstormInputStore };
