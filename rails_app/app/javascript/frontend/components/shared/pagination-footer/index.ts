// Legacy exports (Ads-specific controller pattern)
export { default as PaginationFooterDefault } from "./PaginationFooter";
export { PaginationFooterView } from "./PaginationFooterView";
export { usePaginationFooter } from "./usePaginationFooter";
export * from "./types";

// Compound component exports (new pattern)
export {
  PaginationFooter,
  Root,
  BackButton,
  Actions,
  ActionButton,
  PaginationFooterProvider,
  usePaginationFooterContext,
  usePaginationFooterSelector,
  usePaginationFooterState,
  type RootProps,
  type BackButtonProps,
  type ActionsProps,
  type ActionButtonProps,
  type PaginationFooterContextValue,
  type PaginationFooterProviderProps,
  type PaginationFooterLayout,
} from "./compound";
