import type { ReactNode } from "react";

export interface ActionsProps {
  /** Action buttons to render */
  children: ReactNode;
}

/**
 * PaginationFooter.Actions - Container for right-side action buttons.
 *
 * @example
 * ```tsx
 * <PaginationFooter.Actions>
 *   <PaginationFooter.ActionButton variant="secondary">
 *     Preview
 *   </PaginationFooter.ActionButton>
 *   <PaginationFooter.ActionButton onClick={handleContinue}>
 *     Continue
 *   </PaginationFooter.ActionButton>
 * </PaginationFooter.Actions>
 * ```
 */
export function Actions({ children }: ActionsProps) {
  return <div className="flex gap-3">{children}</div>;
}
