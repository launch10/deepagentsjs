import { useEffect, useRef } from "react";

/**
 * useDeployStatus - Frontend polling hook for LangGraph async job pattern
 *
 * This hook implements the polling pattern described in langgraph-rails-pattern.md:
 * - When deployStatus is "pending" and NOT streaming, poll every 3 seconds
 * - After 5 minutes, slow down to 10 second intervals (backoff)
 * - Stop polling when completed or failed
 *
 * The pattern works because:
 * 1. Backend nodes are idempotent - safe to call multiple times
 * 2. Webhook updates graph state, next poll sees the result
 * 3. No race conditions - worst case is a harmless no-op
 *
 * @example
 * ```tsx
 * function Deploy() {
 *   const { state, status, actions } = useDeployChat();
 *   const { isPending, isComplete, isFailed, isPolling } = useDeployStatus({
 *     deployStatus: state.deployStatus,
 *     isStreaming: status === "streaming" || status === "submitted",
 *     sendCheck: () => actions.submit({ content: "", metadata: { check: true } }),
 *   });
 *
 *   if (isPending) return <Spinner message="Deploying campaign..." />;
 *   if (isComplete) return <Success result={state.deployResult} />;
 *   if (isFailed) return <Error error={state.error} />;
 * }
 * ```
 */

interface UseDeployStatusOptions {
  /** Current deploy status from graph state */
  deployStatus: "pending" | "completed" | "failed" | undefined;
  /** Whether the chat is currently streaming a response */
  isStreaming: boolean;
  /** Function to send a "check" message to poll for updates */
  sendCheck: () => void;
  /** Initial poll interval in ms (default: 3000) */
  initialInterval?: number;
  /** Poll interval after backoff threshold (default: 10000) */
  backoffInterval?: number;
  /** Time in ms before switching to backoff interval (default: 5 minutes) */
  backoffThreshold?: number;
}

interface UseDeployStatusReturn {
  /** Whether deploy is pending (waiting for job completion) */
  isPending: boolean;
  /** Whether deploy is complete */
  isComplete: boolean;
  /** Whether deploy failed */
  isFailed: boolean;
  /** Whether we're actively polling */
  isPolling: boolean;
}

export function useDeployStatus({
  deployStatus,
  isStreaming,
  sendCheck,
  initialInterval = 3000,
  backoffInterval = 10000,
  backoffThreshold = 5 * 60 * 1000, // 5 minutes
}: UseDeployStatusOptions): UseDeployStatusReturn {
  // Track when we started polling for backoff calculation
  const pollStartRef = useRef<number | null>(null);

  const isPending = deployStatus === "pending";
  const isComplete = deployStatus === "completed";
  const isFailed = deployStatus === "failed";

  // Only poll when pending AND not already streaming
  const shouldPoll = isPending && !isStreaming;

  useEffect(() => {
    if (!shouldPoll) {
      // Reset poll start when we stop polling
      pollStartRef.current = null;
      return;
    }

    // Record when we started polling
    if (!pollStartRef.current) {
      pollStartRef.current = Date.now();
    }

    const getInterval = () => {
      const elapsed = Date.now() - pollStartRef.current!;
      // After backoff threshold, slow down polling
      return elapsed > backoffThreshold ? backoffInterval : initialInterval;
    };

    // Send initial check immediately
    sendCheck();

    // Use recursive setTimeout so interval is recalculated each time
    let timeoutId: ReturnType<typeof setTimeout>;
    const poll = () => {
      sendCheck();
      timeoutId = setTimeout(poll, getInterval());
    };
    timeoutId = setTimeout(poll, getInterval());

    return () => clearTimeout(timeoutId);
  }, [shouldPoll, sendCheck, initialInterval, backoffInterval, backoffThreshold]);

  return {
    isPending,
    isComplete,
    isFailed,
    isPolling: shouldPoll,
  };
}
