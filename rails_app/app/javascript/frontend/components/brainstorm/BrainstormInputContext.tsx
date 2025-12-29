/**
 * Re-exports from the zustand-based BrainstormInputProvider.
 * This file maintains backwards compatibility for existing imports.
 *
 * The actual implementation now lives in @context/BrainstormInputProvider
 * which uses a zustand store for better render optimization.
 */
export {
  BrainstormInputProvider,
  useBrainstormInput,
  useBrainstormInputStore,
  useBrainstormTextareaRef,
  // Selectors for fine-grained subscriptions
  selectInput,
  selectSetInput,
  selectAttachments,
  selectAddFiles,
  selectRemoveAttachment,
  selectClearAttachments,
  selectGetUploadIds,
  selectIsUploading,
  selectReset,
  type BrainstormInputStore,
} from "@context/BrainstormInputProvider";
