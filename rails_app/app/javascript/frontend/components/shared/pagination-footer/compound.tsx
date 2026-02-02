// ============================================================================
// PaginationFooter Compound Component
// ============================================================================
// A context-aware pagination footer that integrates with WorkflowProvider.
// BackButton and ContinueButton default to workflow navigation.
//
// Example (simple - uses workflow navigation):
//   <PaginationFooter.Root>
//     <PaginationFooter.BackButton />
//     <PaginationFooter.Actions>
//       <PaginationFooter.ContinueButton />
//     </PaginationFooter.Actions>
//   </PaginationFooter.Root>
//
// Example (custom action - like "Connect Site" on domain page):
//   <PaginationFooter.Root layout="full-bleed" isPending={isLoading}>
//     <PaginationFooter.BackButton />
//     <PaginationFooter.Actions>
//       <PaginationFooter.ActionButton onClick={handleSaveAndNavigate}>
//         Connect Site
//       </PaginationFooter.ActionButton>
//     </PaginationFooter.Actions>
//   </PaginationFooter.Root>
// ============================================================================

// Context and hooks
export {
  PaginationFooterProvider,
  usePaginationFooterContext,
  usePaginationFooterSelector,
  usePaginationFooterState,
  type PaginationFooterContextValue,
  type PaginationFooterProviderProps,
  type PaginationFooterLayout,
} from "./PaginationFooterContext";

// Components
export { Root, type RootProps } from "./Root";
export { BackButton, type BackButtonProps } from "./BackButton";
export { Actions, type ActionsProps } from "./Actions";
export { ActionButton, type ActionButtonProps } from "./ActionButton";
export { ContinueButton, type ContinueButtonProps, type BeforeContinueResult } from "./ContinueButton";

// ============================================================================
// Compound Component Object
// ============================================================================
// This is the main export - use PaginationFooter.Root, PaginationFooter.BackButton, etc.

import { Root } from "./Root";
import { BackButton } from "./BackButton";
import { Actions } from "./Actions";
import { ActionButton } from "./ActionButton";
import { ContinueButton } from "./ContinueButton";

export const PaginationFooter = {
  Root,
  BackButton,
  Actions,
  ActionButton,
  ContinueButton,
};
