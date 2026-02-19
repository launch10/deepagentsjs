import { useLanggraph, type ChatSnapshot, type LanggraphChat } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import type { AdsBridgeType, AdsGraphState } from "@shared";
import { Ads } from "@shared";
import { useChatRegistration } from "@hooks/useChatRegistration";
import { useChatOptions } from "@hooks/useChatOptions";
import { syncLanggraphToStore } from "~/stores/useSyncProject";
import { useCallback } from "react";
import { usePage, router } from "@inertiajs/react";
import type { CampaignProps } from "../workflow-panel/workflow-buddy/ad-campaign.types";

export type AdsSnapshot = ChatSnapshot<AdsGraphState>;

function useAdsChatOptions() {
  const page = usePage<CampaignProps>();

  const onThreadIdAvailable = useCallback(
    (threadId: string) => {
      if (!threadId || threadId === "undefined" || threadId === "null") {
        console.error(
          "[useAdsChat] onThreadIdAvailable called with invalid threadId:",
          threadId
        );
        return;
      }

      // Update Inertia page props with the new thread_id (URL stays the same)
      router.push({
        url: window.location.pathname,
        component: "Ads",
        props: {
          ...page.props,
          thread_id: threadId,
        },
      });
    },
    [page.props]
  );

  return useChatOptions<AdsBridgeType>({
    apiPath: "api/ads/stream",
    merge: Ads.MergeReducer as any,
    onThreadIdAvailable,
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
