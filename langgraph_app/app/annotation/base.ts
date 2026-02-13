import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { HumanMessage, AIMessage, ToolMessage, RemoveMessage } from "@langchain/core/messages";
import type { BaseMessage as LCBaseMessage } from "@langchain/core/messages";

import type {
  ErrorStateType,
  BaseMessage,
  PrimaryKeyType,
  ThreadIDType,
  CreditStatus,
  Intent,
} from "@types";

/**
 * Custom messages reducer that wraps messagesStateReducer
 * and ensures every message has a discoverable timestamp in
 * additional_kwargs.timestamp.
 *
 * This powers the prepareTurn/compact loop: prepareTurn uses
 * findLastAiMessageTime() to scope event fetching, and compact
 * stamps its summary. The reducer catches everything else —
 * human messages, AI messages without provider timestamps,
 * tool messages, etc.
 */
export function timestampedMessagesReducer(
  current: BaseMessage[],
  next: BaseMessage | BaseMessage[]
): BaseMessage[] {
  const messagesToAdd = Array.isArray(next) ? next : [next];

  const timestampedMessages = messagesToAdd.map((msg) => {
    // Skip RemoveMessage — it's a deletion directive, not a real message
    if (msg instanceof RemoveMessage) return msg;

    // Already has a timestamp in additional_kwargs — don't overwrite
    if (msg.additional_kwargs?.timestamp) return msg;

    // AI messages may have provider-supplied response_metadata.timestamp
    const responseTimestamp = (msg.response_metadata as Record<string, unknown> | undefined)
      ?.timestamp;
    if (responseTimestamp) return msg;

    // Stamp it — must reconstruct with the correct message class
    const kwargs = {
      ...msg.additional_kwargs,
      timestamp: new Date().toISOString(),
    };

    if (msg instanceof AIMessage || msg._getType?.() === "ai") {
      return new AIMessage({ ...msg, additional_kwargs: kwargs });
    }
    if (msg instanceof HumanMessage || msg._getType?.() === "human") {
      return new HumanMessage({ ...msg, additional_kwargs: kwargs });
    }
    if (msg instanceof ToolMessage || msg._getType?.() === "tool") {
      return new ToolMessage({ ...msg, additional_kwargs: kwargs } as any);
    }

    // Unknown type — set directly (rare but safe)
    msg.additional_kwargs = kwargs;
    return msg;
  });

  // Reconcile ordering: when new messages (no matching ID in state)
  // appear before existing messages (matching ID), the existing messages
  // need to be removed first so the reducer re-adds them in the correct
  // position. This happens when prepareTurn injects context before an
  // existing human message — the agent returns them in the right order,
  // but the reducer would otherwise keep existing messages locked in place.
  const removals = reconcileOrdering(current, timestampedMessages);
  if (removals.length > 0) {
    const intermediate = messagesStateReducer(current, removals);
    return messagesStateReducer(intermediate, timestampedMessages);
  }

  return messagesStateReducer(current, timestampedMessages);
}

/**
 * Detect existing messages that need repositioning.
 *
 * Walks the new messages: once we see a message with no matching ID in
 * state (a new message), any subsequent message WITH a matching ID is
 * out of order and needs a RemoveMessage so the reducer re-adds it.
 */
function reconcileOrdering(
  current: BaseMessage[],
  incoming: BaseMessage[]
): RemoveMessage[] {
  const stateIds = new Set(
    current.map((m) => m.id).filter((id): id is string => !!id)
  );

  let sawNewMessage = false;
  const removals: RemoveMessage[] = [];

  for (const msg of incoming) {
    if (msg instanceof RemoveMessage) continue;
    if (!msg.id || !stateIds.has(msg.id)) {
      sawNewMessage = true;
    } else if (sawNewMessage) {
      removals.push(new RemoveMessage({ id: msg.id }));
    }
  }

  return removals;
}

export const BaseAnnotation = Annotation.Root({
  threadId: Annotation<ThreadIDType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  error: Annotation<ErrorStateType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  jwt: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: timestampedMessagesReducer,
  }),

  accountId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  projectId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  projectName: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  websiteId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Chat ID for thread ownership tracking (set by createChat nodes)
  chatId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  // Pre-run credit balance in millicredits (set by middleware)
  preRunCreditsRemaining: Annotation<number | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  // Credit status calculated at end of run (for frontend exhaustion notification)
  creditStatus: Annotation<CreditStatus | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  // Intent: user action that triggered this graph invocation
  // Consumed after handling (cleared by handler nodes)
  // Note: LangGraph skips state updates for undefined values, so we use null to clear
  intent: Annotation<Intent | null | undefined>({
    default: () => undefined,
    reducer: (_current, next) => next,
  }),
});
