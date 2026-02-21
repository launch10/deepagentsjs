import { useLanggraph, type ChatSnapshot, type LanggraphChat } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import type { AdsBridgeType, AdsGraphState } from "@shared";
import { Ads } from "@shared";
import { useChatRegistration } from "@hooks/useChatRegistration";
import { useChatOptions } from "@hooks/useChatOptions";
import { syncLanggraphToStore } from "~/stores/useSyncProject";
import { useRef } from "react";
import { usePage } from "@inertiajs/react";
import type { CampaignProps } from "../workflow-panel/workflow-buddy/ad-campaign.types";

export type AdsSnapshot = ChatSnapshot<AdsGraphState>;

/**
 * Module-level cache of the resolved ads threadId.
 *
 * During SPA navigation the Ads component unmounts and remounts, causing
 * useChatOptions to re-run with potentially stale/missing props. Without
 * this cache the SDK creates a fresh chat instance, which triggers
 * useStageInit → updateState → re-streams the entire conversation.
 *
 * Cleared automatically on full page reload (JS runtime restarts).
 */
let resolvedAdsThreadId: string | undefined;

function useAdsChatOptions() {
  const { thread_id, project, chat } = usePage<CampaignProps>().props;

  // Reset cache when navigating between projects via SPA to avoid
  // briefly using a stale thread ID from a previous project.
  const prevProjectRef = useRef(project?.uuid);
  if (project?.uuid !== prevProjectRef.current) {
    prevProjectRef.current = project?.uuid;
    resolvedAdsThreadId = undefined;
  }

  // Server says no active ads chat → clear stale cache from previous SPA navigation.
  // The cache will be repopulated by onThreadIdAvailable once the SDK starts a new thread.
  if (!chat && !thread_id) {
    resolvedAdsThreadId = undefined;
  }

  // Reset cache only when the server provides a real (non-null) thread_id.
  if (thread_id && thread_id !== resolvedAdsThreadId) {
    resolvedAdsThreadId = thread_id;
  }

  return useChatOptions<AdsBridgeType>({
    apiPath: "api/ads/stream",
    merge: Ads.MergeReducer as any,
    getInitialThreadId: () => thread_id ?? resolvedAdsThreadId,
    onThreadIdAvailable: (id) => {
      resolvedAdsThreadId = id;
    },
  });
}

export function useAdsChat(): LanggraphChat<UIMessage, AdsGraphState> {
  const options = useAdsChatOptions();
  const chat = useLanggraph(options, (s) => s.chat);

  // Register the ads chat so we can sync state to current chat from other components
  useChatRegistration("ads", chat);
  syncCampaignToStore();

  return chat;
}

export const useAdsSelector = <TSelected>(selector: (snapshot: AdsSnapshot) => TSelected) => {
  const options = useAdsChatOptions();
  return useLanggraph(options, selector);
};

export function useAdsChatMessages() {
  return useAdsSelector((s) => s.messages);
}

export function useAdsChatState<K extends keyof AdsGraphState>(key: K) {
  return useAdsSelector((s) => s.state[key]);
}

export function useAdsChatFullState() {
  return useAdsSelector((s) => s.state);
}

export function useAdsChatStatus() {
  return useAdsSelector((s) => s.status);
}

export function useAdsChatIsLoading() {
  return useAdsSelector((s) => s.isLoading);
}

export function useAdsChatIsLoadingHistory() {
  return useAdsSelector((s) => s.isLoadingHistory);
}

export function useAdsChatActions() {
  return useAdsSelector((s) => s.actions);
}

export function useAdsChatThreadId() {
  return useAdsSelector((s) => s.threadId);
}

/**
 * Returns the composer for managing message input.
 * Use composer.text, composer.setText, etc.
 */
export function useAdsChatComposer() {
  return useAdsSelector((s) => s.composer);
}

/**
 * Returns whether the chat is currently streaming a response.
 */
export function useAdsChatIsStreaming() {
  return useAdsSelector((s) => {
    const { status } = s;
    return status === "streaming" || status === "submitted";
  });
}

export function useAdsChatIsReady() {
  const isLoadingHistory = useAdsChatIsLoadingHistory();
  const isStreaming = useAdsChatIsStreaming();

  return !isLoadingHistory && !isStreaming;
}

/**
 * Syncs entity IDs from Langgraph state to the core entity store.
 * Call this once in the page component that uses the ads chat.
 */
export function syncCampaignToStore() {
  const websiteId = useAdsChatState("websiteId");
  const projectId = useAdsChatState("projectId");
  const campaignId = useAdsChatState("campaignId");

  syncLanggraphToStore("websiteId", websiteId);
  syncLanggraphToStore("projectId", projectId);
  syncLanggraphToStore("campaignId", campaignId);
}
