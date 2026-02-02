import type { ReactNode } from "react";
import { Button } from "@components/ui/button";
import { usePaginationFooterContext } from "./PaginationFooterContext";

export interface BackButtonProps {
  /** Click handler for back navigation */
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
 * Automatically disables when:
 * - canGoBack is false (from context or props)
 * - isPending is true (navigation in progress)
 * - onClick is not provided
 *
 * @example
 * ```tsx
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

  // Disable if: explicit disabled prop, can't go back, pending, or no handler
  const isDisabled = disabled ?? (!canGoBack || isPending || !onClick);

  return (
    <Button
      variant="link"
      onClick={onClick}
      disabled={isDisabled}
      data-testid={testId}
    >
      {children}
    </Button>
  );
}
