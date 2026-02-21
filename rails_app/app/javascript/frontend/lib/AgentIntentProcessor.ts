import type { AgentIntent } from "@shared";
import type { LanggraphChat } from "langgraph-ai-sdk-react";

type IntentHandler = (intent: AgentIntent) => void;

/** One processor per chat instance, auto-GC'd when chat is collected. */
const processors = new WeakMap<LanggraphChat<any, any>, AgentIntentProcessor>();

export class AgentIntentProcessor {
  private processed = new Set<string>();
  private listeners = new Map<string, Set<IntentHandler>>();

  /**
   * Get or create a processor wired to the chat instance's state callbacks.
   * Uses ~registerStateKeyCallback which fires ONLY when agentIntents changes,
   * not on every SSE token — eliminating 100+ unnecessary re-renders.
   */
  static forChat(chat: LanggraphChat<any, any>): AgentIntentProcessor {
    if (processors.has(chat)) return processors.get(chat)!;

    const processor = new AgentIntentProcessor();
    processors.set(chat, processor);

    // Revisit guard: mark existing intents as processed so they don't re-fire
    // when navigating back to a page
    const existing = (chat.langgraphState as { agentIntents?: AgentIntent[] })
      ?.agentIntents;
    if (existing?.length) processor.markProcessed(existing);

    // Subscribe to future changes — fires ONLY when agentIntents key changes
    chat["~registerStateKeyCallback"]("agentIntents", () => {
      const intents = (chat.langgraphState as { agentIntents?: AgentIntent[] })
        ?.agentIntents;
      if (intents?.length) processor.process(intents);
    });

    return processor;
  }

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
