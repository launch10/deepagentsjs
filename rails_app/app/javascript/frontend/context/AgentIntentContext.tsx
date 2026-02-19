import { createContext, useContext, useEffect, useRef } from "react";
import type { AgentIntentProcessor } from "@lib/AgentIntentProcessor";
import type { AgentIntent } from "@shared";

const AgentIntentCtx = createContext<AgentIntentProcessor | null>(null);
export const AgentIntentProvider = AgentIntentCtx.Provider;

/** Get the processor instance. Throws if outside Chat.Root. */
export function useAgentIntentProcessor(): AgentIntentProcessor {
  const processor = useContext(AgentIntentCtx);
  if (!processor)
    throw new Error(
      "useAgentIntentProcessor must be used within Chat.Root",
    );
  return processor;
}

/**
 * Subscribe to a specific agent intent type. Handler fires exactly once per intent.
 *
 * @example
 * ```tsx
 * // In any component inside Chat.Root:
 * subscribeToAgentIntent('social_links_saved', () => {
 *   queryClient.invalidateQueries({ queryKey: socialLinksKeys.all });
 * });
 * ```
 */
export function subscribeToAgentIntent(
  type: string,
  handler: (intent: AgentIntent) => void,
) {
  const processor = useAgentIntentProcessor();

  // Latest-ref pattern: stable subscription, always calls latest handler.
  // Callers don't need useCallback.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsub = processor.on(type, (intent) => {
      handlerRef.current(intent);
    });
    return () => {
      unsub();
    };
  }, [processor, type]);
}
