import { useCallback } from "react";
import {
  useBrainstormChatActions,
  useBrainstormIsNewConversation,
} from "./useBrainstormChat";
import {
  useWorkflowSteps,
  selectSetPage,
} from "@context/WorkflowStepsProvider";

/**
 * Hook that wraps brainstorm chat actions with workflow state synchronization.
 *
 * When the first message is sent (transitioning from BrainstormLanding to BrainstormConversation),
 * this hook optimistically updates the workflow store to `{page: 'brainstorm'}`.
 *
 * This ensures the HeaderProgressStepper and other workflow-aware components
 * reflect the correct state immediately, without waiting for server response.
 *
 * @example
 * ```tsx
 * // In BrainstormInput.tsx
 * const { sendMessage } = useBrainstormSendMessage();
 *
 * const onSubmit = () => {
 *   sendMessage(); // Automatically syncs workflow state on first message
 * };
 * ```
 */
export function useBrainstormSendMessage() {
  const { sendMessage, ...rest } = useBrainstormChatActions();
  const isNewConversation = useBrainstormIsNewConversation();
  const setPage = useWorkflowSteps(selectSetPage);

  const sendMessageWithWorkflowSync = useCallback(
    (...args: Parameters<typeof sendMessage>) => {
      // Optimistically set page to brainstorm if this is the first message
      console.log(`did we get here? ${isNewConversation}`);
      if (isNewConversation && setPage) {
        setPage("brainstorm");
      }
      return sendMessage(...args);
    },
    [sendMessage, isNewConversation, setPage]
  );

  return { sendMessage: sendMessageWithWorkflowSync, ...rest };
}