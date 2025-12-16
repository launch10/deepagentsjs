import { usePage } from "@inertiajs/react";
import { useLanggraph, type ChatSnapshot } from "langgraph-ai-sdk-react";
import type { AdsBridgeType, AdsGraphState } from "@shared";
import { Ads } from "@shared";
import type { CampaignProps } from "@components/ads/Sidebar/WorkflowBuddy/ad-campaign.types";
import { useChatRegistration } from "./useChatRegistration";

export type AdsSnapshot = ChatSnapshot<AdsGraphState>;

function getAdsChatOptions() {
  const { thread_id, jwt, langgraph_path } = usePage<CampaignProps>().props;
  const url = new URL("api/ads/stream", langgraph_path).toString();

  return {
    api: url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    merge: Ads.MergeReducer as any,
    getInitialThreadId: () => (thread_id ? thread_id : undefined),
  };
}

export function useAdsChat<TSelected = AdsSnapshot>(
  selector?: (snapshot: AdsSnapshot) => TSelected
): TSelected {
  const options = getAdsChatOptions();
  const snapshot = useLanggraph<AdsBridgeType>(options);

  // Register the "ad campaign chat" so we can sync state to current chat from other components
  useChatRegistration("ad_campaign", snapshot.chat);

  return (selector ? selector(snapshot) : snapshot) as TSelected;
}

export function useAdsChatMessages() {
  return useAdsChat((s) => s.messages);
}

export function useAdsChatState<K extends keyof AdsGraphState>(key: K) {
  return useAdsChat((s) => s.state[key]);
}

export function useAdsChatFullState() {
  return useAdsChat((s) => s.state);
}

export function useAdsChatStatus() {
  return useAdsChat((s) => s.status);
}

export function useAdsChatIsLoading() {
  return useAdsChat((s) => s.isLoading);
}

export function useAdsChatIsLoadingHistory() {
  return useAdsChat((s) => s.isLoadingHistory);
}

export function useAdsChatActions() {
  return useAdsChat((s) => ({
    sendMessage: s.sendMessage,
    updateState: s.updateState,
    setState: s.setState,
    stop: s.stop,
  }));
}

export function useAdsChatThreadId() {
  return useAdsChat((s) => s.threadId);
}
