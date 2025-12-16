import { createStore, useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { LanggraphChat } from "langgraph-ai-sdk-react";
import type { Workflow } from "@shared";

type ChatsRegistryState = {
  chats: Partial<Record<Workflow.WorkflowPage, LanggraphChat<any, any>>>;
};

type ChatsRegistryActions = {
  registerChat: (page: Workflow.WorkflowPage, chat: LanggraphChat<any, any>) => void;
  unregisterChat: (page: Workflow.WorkflowPage) => void;
  getChat: (page: Workflow.WorkflowPage) => LanggraphChat<any, any> | undefined;
  syncStageToChat: (page: Workflow.WorkflowPage, stage: string) => void;
};

export type ChatsRegistryStore = ChatsRegistryState & ChatsRegistryActions;

const registrationCounts = new Map<Workflow.WorkflowPage, number>();

export const chatsRegistryStore = createStore<ChatsRegistryStore>()(
  subscribeWithSelector((set, get) => ({
    chats: {},

    registerChat: (page, chat) => {
      const count = registrationCounts.get(page) ?? 0;
      registrationCounts.set(page, count + 1);

      if (count > 0) return;

      set((state) => ({
        chats: { ...state.chats, [page]: chat },
      }));
    },

    unregisterChat: (page) => {
      const count = registrationCounts.get(page) ?? 0;
      if (count <= 1) {
        registrationCounts.delete(page);
        set((state) => {
          const { [page]: _, ...rest } = state.chats;
          return { chats: rest };
        });
      } else {
        registrationCounts.set(page, count - 1);
      }
    },

    getChat: (page) => {
      return get().chats[page];
    },

    syncStageToChat: (page, stage) => {
      const chat = get().chats[page];
      chat?.setState({ stage });
    },
  }))
);

export function useChatsRegistry<T>(selector: (state: ChatsRegistryStore) => T): T {
  return useStore(chatsRegistryStore, selector);
}
