import type { AgentIntent } from "@shared";

type IntentHandler = (intent: AgentIntent) => void;

export class AgentIntentProcessor {
  private processed = new Set<string>();
  private listeners = new Map<string, Set<IntentHandler>>();

  /** Subscribe to a specific intent type. Returns unsubscribe function. */
  on(type: string, handler: IntentHandler): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
    return () => {
      this.listeners.get(type)!.delete(handler);
      if (this.listeners.get(type)!.size === 0) this.listeners.delete(type);
    };
  }

  /** Process intents. Each intent fires to subscribers exactly once. */
  process(intents: AgentIntent[]) {
    for (const intent of intents) {
      if (this.processed.has(intent.createdAt)) continue;
      this.processed.add(intent.createdAt);

      const typeListeners = this.listeners.get(intent.type);
      if (typeListeners) {
        for (const handler of typeListeners) handler(intent);
      }

      const anyListeners = this.listeners.get("*");
      if (anyListeners) {
        for (const handler of anyListeners) handler(intent);
      }
    }
  }

  /** Mark intents as already processed without firing handlers (revisit guard). */
  markProcessed(intents: AgentIntent[]) {
    for (const intent of intents) {
      this.processed.add(intent.createdAt);
    }
  }
}
