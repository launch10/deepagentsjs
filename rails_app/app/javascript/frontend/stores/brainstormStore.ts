import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ChatStatus } from "ai";
import type { MessageWithBlocks, InferBridgeData } from "langgraph-ai-sdk-types";
import type { BrainstormGraphState, BrainstormBridgeType, InertiaProps, Brainstorm } from "@shared";

type BrainstormLanggraphData = InferBridgeData<BrainstormBridgeType>;

type NewBrainstormInertiaProps =
  InertiaProps.paths["/projects/new"]["get"]["responses"]["200"]["content"]["application/json"];
type UpdateBrainstormInertiaProps =
  InertiaProps.paths["/projects/{uuid}/brainstorm"]["get"]["responses"]["200"]["content"]["application/json"];
type BrainstormInertiaProps = NewBrainstormInertiaProps | UpdateBrainstormInertiaProps;

type BrainstormCoreState = {
  project: BrainstormInertiaProps["project"];
  brainstorm: UpdateBrainstormInertiaProps["brainstorm"] | null;
  workflow: UpdateBrainstormInertiaProps["workflow"] | null;
  currentTopic: BrainstormGraphState["currentTopic"];
  remainingTopics: BrainstormGraphState["remainingTopics"];
  skippedTopics: BrainstormGraphState["skippedTopics"];
  availableCommands: BrainstormGraphState["availableCommands"];
  command: BrainstormGraphState["command"];
  placeholderText: BrainstormGraphState["placeholderText"];
};

type RoutingState = {
  rootPath: string;
  langgraphPath: string;
  jwt: string;
  threadId: string | null;
};

type UIState = {
  redirect: Brainstorm.RedirectType | null;
  status: ChatStatus;
  isLoadingHistory: boolean;
  messages: MessageWithBlocks<BrainstormLanggraphData>[];
};

interface BrainstormState {
  routing: RoutingState;
  brainstorm: BrainstormCoreState;
  ui: UIState;
  _hydrated: boolean;
}

interface BrainstormActions {
  hydrateFromInertia: (props: BrainstormInertiaProps) => void;
  updateFromGraph: (state: Partial<BrainstormGraphState>) => void;
  setMessages: (messages: MessageWithBlocks<BrainstormLanggraphData>[]) => void;
  setStatus: (status: ChatStatus) => void;
  setIsLoadingHistory: (loading: boolean) => void;
  setThreadId: (threadId: string | null) => void;
  setRedirect: (redirect: Brainstorm.RedirectType | null) => void;
  clearRedirect: () => void;
  reset: () => void;
}

type BrainstormStore = BrainstormState & BrainstormActions;

const initialRoutingState: RoutingState = {
  rootPath: "",
  langgraphPath: "",
  jwt: "",
  threadId: null,
};

const initialBrainstormCoreState: BrainstormCoreState = {
  project: null,
  brainstorm: null,
  workflow: null,
  currentTopic: undefined,
  remainingTopics: [],
  skippedTopics: [],
  availableCommands: [],
  command: undefined,
  placeholderText: "",
};

const initialUIState: UIState = {
  redirect: null,
  status: "ready",
  isLoadingHistory: false,
  messages: [],
};

const initialState: BrainstormState = {
  routing: initialRoutingState,
  brainstorm: initialBrainstormCoreState,
  ui: initialUIState,
  _hydrated: false,
};

export const useBrainstormStore = create<BrainstormStore>()(
  immer((set) => ({
    ...initialState,

    hydrateFromInertia: (props) => {
      set((state) => {
        state.routing.rootPath = props.root_path;
        state.routing.langgraphPath = props.langgraph_path;
        state.routing.jwt = props.jwt;
        state.routing.threadId = props.thread_id ?? null;
        state.brainstorm.project = props.project ?? null;

        if ("brainstorm" in props) {
          state.brainstorm.brainstorm = props.brainstorm ?? null;
        }
        if ("workflow" in props) {
          state.brainstorm.workflow = props.workflow ?? null;
        }

        state._hydrated = true;
      });
    },

    updateFromGraph: (graphState) => {
      set((state) => {
        if (graphState.projectUUID !== undefined) {
          state.brainstorm.project ||= {};
          state.brainstorm.project.uuid = graphState.projectUUID;
        }
        if (graphState.currentTopic !== undefined) {
          state.brainstorm.currentTopic = graphState.currentTopic;
        }
        if (graphState.remainingTopics !== undefined) {
          state.brainstorm.remainingTopics = graphState.remainingTopics;
        }
        if (graphState.skippedTopics !== undefined) {
          state.brainstorm.skippedTopics = graphState.skippedTopics;
        }
        if (graphState.memories !== undefined && graphState.memories !== null) {
          state.brainstorm.brainstorm ||= {};
          const brainstorm = state.brainstorm.brainstorm;
          const memories = graphState.memories;

          if (memories.idea !== undefined) {
            brainstorm.idea = memories.idea;
          }
          if (memories.audience !== undefined) {
            brainstorm.audience = memories.audience;
          }
          if (memories.solution !== undefined) {
            brainstorm.solution = memories.solution;
          }
          if (memories.socialProof !== undefined) {
            brainstorm.social_proof = memories.socialProof;
          }
        }
        if (graphState.availableCommands !== undefined) {
          state.brainstorm.availableCommands = graphState.availableCommands;
        }
        if (graphState.command !== undefined) {
          state.brainstorm.command = graphState.command;
        }
        if (graphState.placeholderText !== undefined) {
          state.brainstorm.placeholderText = graphState.placeholderText;
        }
        if (graphState.redirect !== undefined) {
          state.ui.redirect = graphState.redirect ?? null;
        }
      });
    },

    setMessages: (messages) => {
      set((state) => {
        state.ui.messages = messages;
      });
    },

    setStatus: (status) => {
      set((state) => {
        state.ui.status = status;
      });
    },

    setIsLoadingHistory: (loading) => {
      set((state) => {
        state.ui.isLoadingHistory = loading;
      });
    },

    setThreadId: (threadId) => {
      set((state) => {
        state.routing.threadId = threadId;
      });
    },

    setRedirect: (redirect) => {
      set((state) => {
        state.ui.redirect = redirect;
      });
    },

    clearRedirect: () => {
      set((state) => {
        state.ui.redirect = null;
      });
    },

    reset: () => {
      set(() => initialState);
    },
  }))
);

export const selectRouting = (state: BrainstormStore) => state.routing;
export const selectBrainstorm = (state: BrainstormStore) => state.brainstorm;
export const selectUI = (state: BrainstormStore) => state.ui;
export const selectMessages = (state: BrainstormStore) => state.ui.messages;
export const selectStatus = (state: BrainstormStore) => state.ui.status;
export const selectRedirect = (state: BrainstormStore) => state.ui.redirect;
export const selectIsHydrated = (state: BrainstormStore) => state._hydrated;
export const selectThreadId = (state: BrainstormStore) => state.routing.threadId;
export const selectJwt = (state: BrainstormStore) => state.routing.jwt;
export const selectLanggraphPath = (state: BrainstormStore) => state.routing.langgraphPath;
