import { useMemo } from "react";
import { useLanggraph, type ChatSnapshot, type LanggraphChat } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import type { SupportBridgeType, SupportGraphState } from "@shared";
import { useChatOptions } from "@hooks/useChatOptions";

export type SupportSnapshot = ChatSnapshot<SupportGraphState>;

const INITIAL_GREETING =
  "Hi! I can help answer questions about Launch10. What would you like to know?";

const INITIAL_ASSISTANT_MESSAGE = {
  id: "initial-greeting",
  role: "assistant" as const,
  blocks: [
    {
      id: "initial-greeting-block",
      type: "text" as const,
      text: INITIAL_GREETING,
    },
  ],
};

function useSupportChatOptions() {
  return useChatOptions<SupportBridgeType>({
    apiPath: "api/support/stream",
    includeAttachments: false,
  });
}

export function useSupportChat(): LanggraphChat<UIMessage, SupportGraphState> {
  const options = useSupportChatOptions();
  return useLanggraph(options, (s) => s.chat);
}

export const useSupportSelector = <TSelected>(
  selector: (snapshot: SupportSnapshot) => TSelected
) => {
  const options = useSupportChatOptions();
  return useLanggraph(options, selector);
};

export function useSupportMessages() {
  const messages = useSupportSelector((s) => s.messages);
  const isStreaming = useSupportIsStreaming();

  // Prepend the initial greeting as the first message (when not actively streaming a response)
  return useMemo(() => {
    // Don't show greeting while streaming the first response
    if (messages.length === 0 && isStreaming) {
      return messages;
    }
    return [INITIAL_ASSISTANT_MESSAGE, ...messages];
  }, [messages, isStreaming]);
}

export function useSupportIsStreaming() {
  return useSupportSelector((s) => {
    const { status } = s;
    return status === "streaming" || status === "submitted";
  });
}

export function useSupportIsLoading() {
  return useSupportSelector((s) => s.isLoading);
}

export function useSupportActions() {
  return useSupportSelector((s) => s.actions);
}
