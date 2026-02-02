import type { ReactNode } from "react";
import { Button } from "@components/ui/button";
import { Spinner } from "@components/ui/spinner";
import { usePaginationFooterContext } from "./PaginationFooterContext";

export interface ActionButtonProps {
  /** Button content */
  children: ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Override disabled state (defaults to isPending from context) */
  disabled?: boolean;
  /** Show loading spinner */
  loading?: boolean;
  /** Trigger shake animation on validation failure */
  validationFailed?: boolean;
  /** Callback when shake animation ends */
  onAnimationEnd?: () => void;
  /** Test ID for e2e testing */
  "data-testid"?: string;
}

/**
 * PaginationFooter.ActionButton - Action button with loading and validation states.
 *
 * Automatically integrates with context:
 * - Disables during pending state (unless explicitly overridden)
 * - Supports shake animation for validation failures
 * - Shows spinner when loading
 *
 * @example Basic usage
 * ```tsx
 * <PaginationFooter.ActionButton onClick={handleContinue}>
 *   Continue
 * </PaginationFooter.ActionButton>
 * ```
 *
 * @example With validation shake
 * ```tsx
 * <PaginationFooter.ActionButton
 *   onClick={handleContinue}
 *   validationFailed={showShake}
 *   onAnimationEnd={clearShake}
 * >
 *   Continue
 * </PaginationFooter.ActionButton>
 * ```
 */
export function ActionButton({
  children,
  onClick,
  disabled,
  loading,
  validationFailed,
  onAnimationEnd,
  "data-testid": testId,
}: ActionButtonProps) {
  const { isPending } = usePaginationFooterContext();

  // Disable if: explicit disabled prop, or pending state from context
  const isDisabled = disabled ?? isPending;

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      className={validationFailed ? "animate-shake" : undefined}
      onAnimationEnd={onAnimationEnd}
      data-testid={testId}
    >
      {loading && <Spinner />}
      {children}
    </Button>
  );
}
