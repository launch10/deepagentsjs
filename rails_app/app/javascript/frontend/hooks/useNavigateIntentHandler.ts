import { isNavigateAgentIntent, type Workflow } from "@shared";
import { useWorkflowOptional, selectNavigate } from "@context/WorkflowProvider";
import { subscribeToAgentIntent } from "@context/AgentIntentContext";

/**
 * Subscribes to "navigate" agent intents and drives workflow navigation.
 * Call this from any component inside both Chat.Root and WorkflowProvider.
 */
export function useNavigateIntentHandler() {
  const workflowNavigate = useWorkflowOptional(selectNavigate);

  subscribeToAgentIntent("navigate", (intent) => {
    if (isNavigateAgentIntent(intent)) {
      workflowNavigate?.(
        intent.payload.page,
        (intent.payload.substep as Workflow.SubstepName) ?? null,
      );
    }
  });
}
