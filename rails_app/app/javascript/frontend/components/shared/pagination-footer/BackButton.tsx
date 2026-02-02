import type { ReactNode } from "react";
import { Button } from "@components/ui/button";
import { usePaginationFooterContext } from "./PaginationFooterContext";
import { useWorkflowOptional, selectBack } from "@context/WorkflowProvider";

export interface BackButtonProps {
  /** Click handler for back navigation. Defaults to workflow store's back(). */
  onClick?: () => void;
  /** Custom label (defaults to "Previous Step") */
  children?: ReactNode;
  /** Override disabled state (auto-detected from context if not provided) */
  disabled?: boolean;
  /** Test ID for e2e testing */
  "data-testid"?: string;
}

/**
 * PaginationFooter.BackButton - Back navigation button.
 *
 * Default behavior: uses workflow store's back() to navigate to previous step.
 * This works even if user navigated directly to the current page.
 * Override with onClick prop for custom navigation.
 *
 * Automatically disables when:
 * - canGoBack is false (from context or props)
 * - isPending is true (navigation in progress)
 *
 * @example
 * ```tsx
 * // Default: workflow back (previous step)
 * <PaginationFooter.BackButton />
 *
 * // Custom navigation
 * <PaginationFooter.BackButton onClick={handleBack}>
 *   Previous Step
 * </PaginationFooter.BackButton>
 * ```
 */
export function BackButton({
  onClick,
  children = "Previous Step",
  disabled,
  "data-testid": testId,
}: BackButtonProps) {
  const { canGoBack, isPending } = usePaginationFooterContext();
  const workflowBack = useWorkflowOptional(selectBack);

  const handleClick = onClick ?? workflowBack ?? (() => window.history.back());

  // Disable if: explicit disabled prop, can't go back, or pending
  const isDisabled = disabled ?? (!canGoBack || isPending);

  return (
    <Button
      variant="link"
      onClick={handleClick}
      disabled={isDisabled}
      data-testid={testId}
    >
      {children}
    </Button>
  );
}
