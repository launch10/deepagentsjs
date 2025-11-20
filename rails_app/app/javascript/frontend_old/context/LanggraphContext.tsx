import React from "react";
import { useStore } from "@nanostores/react";
import { type ThreadData, type ThreadValues } from "@types/thread";
import { type MessageFieldWithRole } from "@langchain/core/messages";
import { type FileMap } from "@shared/models/file";
import { createClient } from "@lib/utils/client";
import { LIMIT_PARAM, OFFSET_PARAM } from "@lib/constants";
import { redirectToThreadId } from "@hooks/useThreadId";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  type GraphState,
  type App as AppState,
  type CodeTasksState,
} from "@shared/state/graph";
import { useQueryParams } from "@hooks/useQueryParams";
import { pageStore } from "@stores/page";
import axios from "axios";
import { projectStore } from "@stores/project";
import { type APIProject } from "@types/project";
import { type CodeTask } from "@shared/models/codeTask";

type Config = Record<string, any>;
type StreamableGraphState = GraphState & Config;

export type BackendEvent = {
  event: string;
  task: CodeTask;
  id: string;
};
export interface TaggedMessage extends MessageFieldWithRole {
  tags?: string[];
}

type LanggraphContextType = {
  isLoading: boolean;
  isFetchingThreads: boolean;
  hasMoreThreads: boolean;
  projectName: string | undefined;
  messages: TaggedMessage[];
  files: FileMap;
  codeTasks: CodeTasksState;
  currentThreadId: string | undefined;
  fetchThreads: () => Promise<void>; // Decorate with tenantId from encrypted cookies
  submit: (message: string, checkpoint?: string) => void;
  stop: () => void;
  events: BackendEvent[];
  getMessagesMetadata: (message: any) => any;
};

const LanggraphContext = React.createContext<LanggraphContextType | undefined>(
  undefined
);

export function LanggraphProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { jwt, accountId, rootPath, threadId, pageId } = useStore(pageStore);
  const [chatHasStarted, setChatHasStarted] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isFetchingThreads, setIsFetchingThreads] = React.useState(false);
  const [hasMoreThreads, setHasMoreThreads] = React.useState(true);
  const [searchParams, setSearchParams] = useQueryParams();
  const limitParam = Number(searchParams.get(LIMIT_PARAM)) || 10;
  const offsetParam = Number(searchParams.get(OFFSET_PARAM)) || 0;
  const [projectHasBeenNamed, setProjectHasBeenNamed] = React.useState(false);
  const [events, setEvents] = React.useState<BackendEvent[]>([]);

  const [messageIdToTags, setMessageIdToTags] = React.useState<
    Record<string, Set<string>>
  >({});

  const handleLangChainEvent = React.useCallback((eventData: any) => {
    if (eventData.event === "on_chat_model_stream") {
      const chunk = eventData.data?.chunk;
      const messageId = chunk?.id;
      const tags = eventData.tags || [];

      setMessageIdToTags((prev) => {
        const currentTagsForId = new Set(prev[messageId] || []);
        tags.forEach((tag) => currentTagsForId.add(tag));
        return {
          ...prev,
          [messageId]: currentTagsForId,
        };
      });
    }
  }, []);

  const stream = useStream<StreamableGraphState>({
    apiUrl: import.meta.env.VITE_LANGGRAPH_API_URL!,
    assistantId: import.meta.env.VITE_LANGGRAPH_ASSISTANT_ID!,
    defaultHeaders: {
      Authorization: `Bearer ${jwt}`, // remove, use http-only encrypted cookie
      "X-Account-Id": accountId ? accountId.toString() : "",
    },
    onThreadId: (threadId: string) => {
      redirectToThreadId(threadId);
    },
    threadId: threadId,
    onLangChainEvent: handleLangChainEvent,
    onFinish: () => {
      setIsLoading(false);
      fetchThreads();
    },
    onCustomEvent: (event: any) => {
      let backendEvent: BackendEvent = event as BackendEvent;
      setEvents((prev) => [...prev, backendEvent]);
    },
  });

  // Cleanup stream on unmount
  React.useEffect(() => {
    return () => {
      if (stream) {
        stream.stop();
      }
    };
  }, [pageId]);

  const onSubmit = (message: string, checkpoint?: string) => {
    setIsLoading(true);
    setChatHasStarted(true);
    const input = {
      userRequest: { type: "human", content: message },
      jwt: jwt!,
      accountId: accountId!,
    };
    const checkpointConfig = checkpoint ? { checkpoint } : undefined;
    const config = {
      streamMode: ["events", "values", "custom"],
      ...checkpointConfig,
    };
    stream.submit(input, config); // Values provides final state
  };

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!jwt) {
      return;
    }
    try {
      fetchThreads();
    } catch (e) {
      console.error(e);
    }
  }, [limitParam, offsetParam, jwt, pageId]);

  // Not shown, but the core of the security mechanism here is browser-based encrypted cookie,
  // the langgraph server confirms the JWT with the rails server
  const fetchThreads = React.useCallback(async () => {
    setIsFetchingThreads(true);
    try {
      const response = await axios.get(`${rootPath}/projects`, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        params: {
          offset: offsetParam,
          limit: limitParam,
        },
      });
      const data = (response.data?.projects || []) as APIProject[];
      projectStore.add(data);
      setHasMoreThreads(data.length === limitParam);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingThreads(false);
    }
  }, [offsetParam, limitParam]);

  React.useEffect(() => {
    if (!chatHasStarted) {
      stream.messages.forEach((message) => {
        if (message.id && !Object.keys(messageIdToTags).includes(message.id)) {
          const tags = new Set<string>();
          tags.add("notify");
          setMessageIdToTags((prev) => ({
            ...prev,
            [message.id]: tags,
          }));
        }
      });
    }
  }, [stream.messages, chatHasStarted, messageIdToTags]);

  const messages: TaggedMessage[] = React.useMemo(() => {
    const augmented = stream.messages.map((msg): TaggedMessage => {
      if (msg.id && messageIdToTags[msg.id]) {
        return {
          ...msg,
          tags: Array.from(messageIdToTags[msg.id]),
        };
      }
      return { ...msg, tags: [] };
    });
    return augmented.filter(
      (message) =>
        message.type === "human" ||
        ((message.tags || []).length > 0 &&
          (message.tags || []).includes("notify"))
    );
  }, [stream.messages, messageIdToTags]);

  const appState: AppState | undefined = stream.values?.app as
    | AppState
    | undefined;
  // const codeTasks = (appState?.codeTasks || {notify: [], queue: [], completedTasks: []}) as CodeTasksState;
  const codeTasks = (
    chatHasStarted
      ? appState?.codeTasks || { notify: [], queue: [], completedTasks: [] }
      : { notify: [], queue: [], completedTasks: [] }
  ) as CodeTasksState;
  const projectName = stream.values?.projectName;

  React.useEffect(() => {
    if (!projectName) {
      return;
    }
    if (projectHasBeenNamed) {
      return;
    }
    if (!threadId) {
      return;
    }
    setProjectHasBeenNamed(true);
    projectStore.add({
      threadId,
      projectName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }, [projectName, projectHasBeenNamed]);

  const contextValue: LanggraphContextType = {
    isLoading,
    isFetchingThreads,
    projectName,
    messages,
    files: {},
    codeTasks,
    hasMoreThreads,
    fetchThreads,
    submit: onSubmit,
    stop: stream.stop,
    events,
    getMessagesMetadata: stream.getMessagesMetadata,
  };

  return (
    <LanggraphContext.Provider value={contextValue}>
      {children}
    </LanggraphContext.Provider>
  );
}

export function useLanggraphContext() {
  const context = React.useContext(LanggraphContext);
  if (!context) {
    throw new Error(
      "useLanggraphContext must be used within a LanggraphProvider"
    );
  }
  return context;
}
