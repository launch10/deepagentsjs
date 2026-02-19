import { useEffect, useMemo, useRef } from "react";
import type { LanggraphChat } from "langgraph-ai-sdk-react";
import { useChatSelector } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import { type AgentIntent, isNavigateAgentIntent, type Workflow } from "@shared";
import { useWorkflowOptional, selectNavigate } from "@context/WorkflowProvider";
import { AgentIntentProcessor } from "@lib/AgentIntentProcessor";

/**
 * Creates and drives the AgentIntentProcessor for a chat instance.
 * Called once in ChatProvider — NOT by individual pages.
 *
 * - Creates processor (stable, once per chat)
 * - Subscribes to agentIntents via useChatSelector (smart subscription)
 * - Registers central handlers (navigate)
 * - Feeds state changes into processor.process()
 * - Returns processor for context provision
 */
export function useAgentIntentSetup<TState extends Record<string, unknown>>(
  chat: LanggraphChat<UIMessage, TState>,
): AgentIntentProcessor {
  const processor = useMemo(() => new AgentIntentProcessor(), []);

  // Central handler: navigate
  const workflowNavigate = useWorkflowOptional(selectNavigate);
  useEffect(() => {
    return processor.on("navigate", (intent) => {
      if (isNavigateAgentIntent(intent)) {
        workflowNavigate?.(
          intent.payload.page,
          (intent.payload.substep as Workflow.SubstepName) ?? null,
        );
      }
    });
  }, [processor, workflowNavigate]);

  // Subscribe to agentIntents from chat state (smart subscription)
  const agentIntents = useChatSelector(
    chat,
    (s) => (s.state as { agentIntents?: AgentIntent[] })?.agentIntents,
  );

  // Revisit guard: mark mount-time intents as already processed.
  // This prevents re-firing stale intents when navigating back to a page.
  // The ref captures whatever intents exist at mount; the effect marks them once.
  const mountIntentsRef = useRef(agentIntents);
  useEffect(() => {
    if (mountIntentsRef.current?.length) {
      processor.markProcessed(mountIntentsRef.current);
    }
  }, [processor]);

  // Process intents immediately as they appear. The agentIntents reducer uses
  // replace semantics, so intents only exist for one node transition — if we
  // wait for streaming to end, they'll already be gone. The processor's
  // Set<createdAt> dedup ensures each intent fires exactly once.
  //
  // We track the last-seen fingerprint to avoid calling process() on every
  // SSE token update — useChatSelector returns a new array reference each
  // time the state object is rebuilt, even when agentIntents hasn't changed.
  const lastIntentKeyRef = useRef("");
  useEffect(() => {
    if (!agentIntents?.length) return;
    const key = agentIntents.map((i) => i.createdAt).join(",");
    if (key === lastIntentKeyRef.current) return;
    lastIntentKeyRef.current = key;
    processor.process(agentIntents);
  }, [agentIntents, processor]);

  return processor;
}
