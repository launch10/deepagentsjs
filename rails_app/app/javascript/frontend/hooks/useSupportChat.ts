import { useLanggraph, type ChatSnapshot, type LanggraphChat } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import type { SupportBridgeType, SupportGraphState } from "@shared";
import { useChatOptions } from "@hooks/useChatOptions";

export type SupportSnapshot = ChatSnapshot<SupportGraphState>;

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
  return useSupportSelector((s) => s.messages);
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
