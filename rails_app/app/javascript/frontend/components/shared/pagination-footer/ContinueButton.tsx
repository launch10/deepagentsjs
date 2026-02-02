import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ActionButton, type ActionButtonProps } from "./ActionButton";
import { useWorkflowOptional, selectContinue } from "@context/WorkflowProvider";

/** Return type for beforeContinue callback */
export type BeforeContinueResult = boolean | string | Promise<boolean | string>;

export interface ContinueButtonProps extends Omit<ActionButtonProps, "children" | "onClick" | "validationFailed" | "onAnimationEnd"> {
  /** Button content (defaults to "Continue") */
  children?: ReactNode;
  /**
   * Called before continuing to next step.
   * - Return true to proceed with navigation
   * - Return false to cancel navigation and shake button
   * - Return string to cancel, shake, AND show error toast with that message
   *
   * @example Validation
   * beforeContinue={() => form.validate() || "Please fix the errors above"}
   *
   * @example Async save
   * beforeContinue={async () => {
   *   try {
   *     await save();
   *     return true;
   *   } catch (e) {
   *     return e.message || "Failed to save";
   *   }
   * }}
   */
  beforeContinue?: () => BeforeContinueResult;
  /**
   * Fully override click behavior. Use beforeContinue instead for most cases.
   * If provided, beforeContinue is ignored and no automatic navigation occurs.
   */
  onClick?: () => void;
}

/**
 * PaginationFooter.ContinueButton - Continue to next workflow step.
 *
 * Wraps ActionButton with default behavior of workflow store's continue().
 * Supports beforeContinue for validation/saving before navigation.
 * Automatically shakes when beforeContinue returns false or error string.
 * Automatically shows toast when beforeContinue returns an error string.
 *
 * @example Simple continue
 * ```tsx
 * <PaginationFooter.ContinueButton />
 * ```
 *
 * @example With form validation (auto-shakes on failure)
 * ```tsx
 * <PaginationFooter.ContinueButton
 *   beforeContinue={() => form.validate() || "Please fix the errors above"}
 * />
 * ```
 *
 * @example Save data before continuing (auto-toasts on error)
 * ```tsx
 * <PaginationFooter.ContinueButton
 *   beforeContinue={async () => {
 *     try {
 *       await saveDomain.mutateAsync(selection);
 *       return true;
 *     } catch (e) {
 *       return e.message || "Failed to save";
 *     }
 *   }}
 * >
 *   Save & Continue
 * </PaginationFooter.ContinueButton>
 * ```
 */
export function ContinueButton({
  children = "Continue",
  beforeContinue,
  onClick,
  ...props
}: ContinueButtonProps) {
  const workflowContinue = useWorkflowOptional(selectContinue);
  const [shake, setShake] = useState(false);

  const handleClick = useCallback(async () => {
    // If onClick is provided, use it directly (full override)
    if (onClick) {
      onClick();
      return;
    }

    // If beforeContinue is provided, run it first
    if (beforeContinue) {
      const result = await beforeContinue();

      // String = error message → toast + shake
      if (typeof result === "string") {
        toast.error(result);
        setShake(true);
        return;
      }

      // false = can't continue → shake (caller handles showing errors)
      if (!result) {
        setShake(true);
        return;
      }
    }

    // Navigate to next step
    workflowContinue?.();
  }, [onClick, beforeContinue, workflowContinue]);

  const handleAnimationEnd = useCallback(() => {
    setShake(false);
  }, []);

  return (
    <ActionButton
      onClick={handleClick}
      validationFailed={shake}
      onAnimationEnd={handleAnimationEnd}
      {...props}
    >
      {children}
    </ActionButton>
  );
}
