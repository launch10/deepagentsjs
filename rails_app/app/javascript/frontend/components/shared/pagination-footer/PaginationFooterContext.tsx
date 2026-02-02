import { createContext, useContext, type ReactNode } from "react";
import {
  useWorkflowOptional,
  selectCanGoBack,
  selectCanGoForward,
} from "@context/WorkflowProvider";

export type PaginationFooterLayout = "container" | "full-bleed";

export interface PaginationFooterContextValue {
  /** Whether navigation is pending (disables buttons) */
  isPending: boolean;
  /** Whether back navigation is available */
  canGoBack: boolean;
  /** Whether forward navigation is available */
  canGoForward: boolean;
  /** Layout variant */
  layout: PaginationFooterLayout;
}

const PaginationFooterContext = createContext<PaginationFooterContextValue | null>(null);

export interface PaginationFooterProviderProps {
  children: ReactNode;
  /** Layout variant - "container" for Ads, "full-bleed" for Website */
  layout?: PaginationFooterLayout;
  /** Override pending state (auto-detected from WorkflowProvider if not provided) */
  isPending?: boolean;
  /** Override back availability (auto-detected from WorkflowProvider if not provided) */
  canGoBack?: boolean;
  /** Override forward availability (auto-detected from WorkflowProvider if not provided) */
  canGoForward?: boolean;
}

/**
 * Hook to build context value by merging WorkflowProvider context with props.
 * Props take precedence over context values.
 */
export function usePaginationFooterState(
  props: Omit<PaginationFooterProviderProps, "children">
): PaginationFooterContextValue {
  // Try to get values from WorkflowProvider (returns undefined if not present)
  const workflowCanGoBack = useWorkflowOptional(selectCanGoBack);
  const workflowCanGoForward = useWorkflowOptional(selectCanGoForward);

  return {
    // Props override context values, with defaults
    canGoBack: props.canGoBack ?? workflowCanGoBack ?? true,
    canGoForward: props.canGoForward ?? workflowCanGoForward ?? true,
    isPending: props.isPending ?? false,
    layout: props.layout ?? "container",
  };
}

/**
 * Provider component for PaginationFooter context.
 * Automatically detects WorkflowProvider context if present.
 */
export function PaginationFooterProvider({
  children,
  ...props
}: PaginationFooterProviderProps) {
  const value = usePaginationFooterState(props);

  return (
    <PaginationFooterContext.Provider value={value}>
      {children}
    </PaginationFooterContext.Provider>
  );
}

/**
 * Hook to access pagination footer context.
 * @throws Error if used outside PaginationFooter.Root
 */
export function usePaginationFooterContext(): PaginationFooterContextValue {
  const ctx = useContext(PaginationFooterContext);
  if (!ctx) {
    throw new Error(
      "usePaginationFooterContext must be used within PaginationFooter.Root"
    );
  }
  return ctx;
}

/**
 * Hook to access pagination footer context with a selector for fine-grained subscriptions.
 * @throws Error if used outside PaginationFooter.Root
 */
export function usePaginationFooterSelector<T>(
  selector: (state: PaginationFooterContextValue) => T
): T {
  const ctx = usePaginationFooterContext();
  return selector(ctx);
}
