import type { CreditStatus } from "@shared";
import { useCreditStatusWatcher } from "~/hooks/useCreditStatusWatcher";

/**
 * A component that watches langgraph state for creditStatus updates.
 *
 * Unlike CreditExhaustionDetector (which detects 402 errors), this component
 * watches for creditStatus in the stream response, enabling "mid-run exhaustion"
 * detection when a user exhausts their credits during a run.
 *
 * Place this inside a component that has access to the langgraph state selector.
 *
 * @example
 * ```tsx
 * function BrainstormPageContent() {
 *   const creditStatus = useBrainstormSelector((s) => s.state.creditStatus);
 *
 *   return (
 *     <>
 *       <CreditStatusWatcher creditStatus={creditStatus} />
 *       <ChatMessages />
 *       <ChatInput />
 *     </>
 *   );
 * }
 * ```
 */
interface CreditStatusWatcherProps {
  creditStatus: CreditStatus | undefined | null;
}

export function CreditStatusWatcher({ creditStatus }: CreditStatusWatcherProps): null {
  useCreditStatusWatcher(creditStatus);

  // This component renders nothing - it's just for side effects
  return null;
}
