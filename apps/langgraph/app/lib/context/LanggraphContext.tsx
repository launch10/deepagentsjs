import React, { useMemo } from "react";
import { type ThreadData, type ThreadValues } from "@lib/types";
import { type MessageFieldWithRole } from "@langchain/core/messages";
import { type FileMap } from "@models/file";
import { type CodeTask } from "@models/codeTask";
import { createClient } from "@lib/utils/client";
import { useSearchParams } from "@remix-run/react";
import { LIMIT_PARAM, OFFSET_PARAM } from "@lib/constants";
import { type Thread } from "@langchain/langgraph-sdk";
import { useThreadId, redirectToThreadId } from "@lib/hooks/useThreadId";
import { useStream } from '@langchain/langgraph-sdk/react';
import { type GraphState, type App as AppState, type CodeTasksState } from "@shared/state/graph";

type Config = Record<string, any>;
type StreamableGraphState = GraphState & Config; 
export interface TaggedMessage extends MessageFieldWithRole {
  tags?: string[];
}

type LanggraphContextType = {
    isLoading: boolean;
    isFetchingThreads: boolean;
    hasMoreThreads: boolean;
    projectName: string | undefined;
    messages: TaggedMessage[];
    files: FileMap,
    codeTasks: CodeTasksState,
    currentThreadId: string | undefined,
    threads: ThreadData<ThreadValues>[],
    fetchThreads: () => Promise<void>, // Decorate with tenantId from encrypted cookies
    clearThreadData: () => void,
    submit: (message: string) => void,
    stop: () => void,
};

const LanggraphContext = React.createContext<LanggraphContextType | undefined>(
  undefined
);

export function LanggraphProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [chatHasStarted, setChatHasStarted] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isFetchingThreads, setIsFetchingThreads] = React.useState(false);
  const [hasMoreThreads, setHasMoreThreads] = React.useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const limitParam = Number(searchParams.get(LIMIT_PARAM)) || 10;
  const offsetParam = Number(searchParams.get(OFFSET_PARAM)) || 0;
  const { threadId: urlThreadId } = useThreadId();
  const [currentThreadId, setCurrentThreadId] = React.useState<string | undefined>(urlThreadId);
  const [threads, setThreads] = React.useState<
    ThreadData<ThreadValues>[]
  >([]);

  const [messageIdToTags, setMessageIdToTags] = React.useState<
    Record<string, Set<string>>
  >({});

  const handleLangChainEvent = React.useCallback((eventData: any) => {
    if (eventData.event === 'on_chat_model_stream') {
      const chunk = eventData.data?.chunk;
      const messageId = chunk?.id;
      const tags = eventData.tags || [];

      setMessageIdToTags(prev => {
        const currentTagsForId = new Set(prev[messageId] || []);
        tags.forEach(tag => currentTagsForId.add(tag));
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
      threadId: currentThreadId,
      onThreadId: (threadId) => {
        setCurrentThreadId(threadId);
        redirectToThreadId(threadId);
      },
      onLangChainEvent: handleLangChainEvent,
      onFinish: () => {
        setIsLoading(false);
        fetchThreads();
      },
    });

  const onSubmit = (message: string) => {
    setIsLoading(true);
    setChatHasStarted(true);
    stream.submit({
      userRequest: { type: "human", content: message },
    }, {streamMode: ["events", "values"]}); // Values provides final state
  };

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      fetchThreads();
    } catch (e) {
      console.error(e);
    }
  }, [limitParam, offsetParam]);

  // This needs to be upgraded to use browser-based encrypted cookie,
  // and backend needs to fetch tenantId from encrypted cookie
  const fetchThreads = React.useCallback(
    async () => {
      setIsFetchingThreads(true);
      try {
        const client = createClient();
        const newThreads = await client.threads.search({
          offset: offsetParam,
          limit: limitParam,
        });
        setThreads((prevThreads) => {
          const allThreads = [...(prevThreads.map((thread) => thread.thread) || []), ...newThreads].filter((thread) => thread.values?.projectName);
          const uniqueThreads = [...new Map(allThreads.map(thread => [thread.values.projectName, thread])).values()];
          const sortedThreads = uniqueThreads.sort((a, b) => {
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          });
          return sortedThreads.map(thread => ({
            thread: thread,
            status: "idle" as const,
          }));
        });
        setHasMoreThreads(newThreads.length === limitParam);
      } catch (e) {
        console.error(e);
      } finally {
        setIsFetchingThreads(false);
      }
    }, [offsetParam, limitParam] 
  )

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
        ((message.tags || []).length > 0 && (message.tags || []).includes('notify'))
    );
  }, [stream.messages, messageIdToTags]);

  const appState: AppState | undefined = stream.values?.app as AppState | undefined;
  // If chat hasn't started, rely on files from app state. We only need to process tasks if chat has started (aka changes in real-time)
  const codeTasks = (chatHasStarted ? (appState?.codeTasks || {queue: [], completedTasks: []}) : {queue: [], completedTasks: []}) as CodeTasksState;
  const projectName = stream.values?.projectName;

  const contextValue: LanggraphContextType = {    
    isLoading,
    isFetchingThreads,
    projectName,
    messages,
    files: {},
    codeTasks,
    threads,
    currentThreadId,
    hasMoreThreads,
    fetchThreads,
    clearThreadData: () => setThreads([]),
    submit: onSubmit,
    stop: stream.stop,
  }

  return (
    <LanggraphContext.Provider value={contextValue}>
      {children}
    </LanggraphContext.Provider>
  )
}

export function useLanggraphContext() {
  const context = React.useContext(LanggraphContext);
  if (!context) {
    throw new Error("useLanggraphContext must be used within a LanggraphProvider");
  }
  return context;
}