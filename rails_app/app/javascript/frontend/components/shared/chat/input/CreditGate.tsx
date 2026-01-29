import type { ReactNode } from "react";
import { Link } from "@inertiajs/react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { useCreditStore } from "~/stores/creditStore";

export interface CreditGateProps {
  children: ReactNode;
  className?: string;
}

/**
 * Chat.Input.CreditGate - Shows a "Purchase credits" link below the chat input
 * when credits are exhausted.
 *
 * The submit button is separately disabled via its own credit check.
 * When credits are available, renders children normally with no overhead.
 *
 * @example
 * ```tsx
 * <Chat.Input.CreditGate>
 *   <Chat.Input.DropZone>
 *     <Chat.Input.Textarea />
 *     <Chat.Input.SubmitButton />
 *   </Chat.Input.DropZone>
 * </Chat.Input.CreditGate>
 * ```
 */
export function CreditGate({ children, className }: CreditGateProps) {
  const isOutOfCredits = useCreditStore((s) => s.isOutOfCredits);

  if (!isOutOfCredits) {
    return className ? <div className={className}>{children}</div> : <>{children}</>;
  }

  return (
    <div className={className} data-testid="credit-gate">
      {children}

      <div className="flex items-center gap-1.5 pt-2">
        <SparklesIcon className="w-4 h-4 text-neutral-400" />
        <Link
          href="/settings"
          className="text-sm text-neutral-500 underline hover:text-neutral-700 transition-colors"
          data-testid="credit-gate-link"
        >
          Purchase credits to use AI
        </Link>
      </div>
    </div>
  );
}
