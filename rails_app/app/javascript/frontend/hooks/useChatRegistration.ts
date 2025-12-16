import { useEffect } from "react";
import type { LanggraphChat } from "langgraph-ai-sdk-react";
import { chatsRegistryStore } from "@stores/chatsRegistry";
import type { Workflow } from "@shared";

export function useChatRegistration(
  page: Workflow.WorkflowPage,
  chat: LanggraphChat<any, any>
) {
  useEffect(() => {
    chatsRegistryStore.getState().registerChat(page, chat);

    return () => {
      chatsRegistryStore.getState().unregisterChat(page);
    };
  }, [page, chat]);
}
