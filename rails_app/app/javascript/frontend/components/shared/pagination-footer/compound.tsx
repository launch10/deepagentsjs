// ============================================================================
// PaginationFooter Compound Component
// ============================================================================
// A context-aware pagination footer that works both inside and outside
// WorkflowProvider. Use PaginationFooter.Root to wrap, and compose with
// BackButton, Actions, and ActionButton.
//
// Example (outside WorkflowProvider - Website):
//   <PaginationFooter.Root layout="full-bleed" isPending={isLoading}>
//     <PaginationFooter.BackButton onClick={handleBack} />
//     <PaginationFooter.Actions>
//       <PaginationFooter.ActionButton onClick={handleContinue}>
//         Continue
//       </PaginationFooter.ActionButton>
//     </PaginationFooter.Actions>
//   </PaginationFooter.Root>
//
// Example (inside WorkflowProvider - Ads):
//   <PaginationFooter.Root layout="container">
//     <PaginationFooter.BackButton onClick={handleBack} />
//     <PaginationFooter.Actions>
//       <PaginationFooter.ActionButton
//         onClick={handleContinue}
//         validationFailed={shake}
//         onAnimationEnd={clearShake}
//       >
//         Continue
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

// ============================================================================
// Compound Component Object
// ============================================================================
// This is the main export - use PaginationFooter.Root, PaginationFooter.BackButton, etc.

import { Root } from "./Root";
import { BackButton } from "./BackButton";
import { Actions } from "./Actions";
import { ActionButton } from "./ActionButton";

export const PaginationFooter = {
  Root,
  BackButton,
  Actions,
  ActionButton,
};
