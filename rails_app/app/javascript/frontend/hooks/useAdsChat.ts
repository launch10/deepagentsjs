import { usePage } from "@inertiajs/react";
import { useMemo } from "react";
import { useLanggraph, type ChatSnapshot } from "langgraph-ai-sdk-react";
import type { AdsBridgeType, AdsGraphState } from "@shared";
import { Ads } from "@shared";
import type { CampaignProps } from "@components/ads/sidebar/workflow-buddy/ad-campaign.types";
import { useChatRegistration } from "./useChatRegistration";

export type AdsSnapshot = ChatSnapshot<AdsGraphState>;

function useAdsChatOptions() {
  const { thread_id, jwt, langgraph_path } = usePage<CampaignProps>().props;

  return useMemo(() => {
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
  }, [thread_id, jwt, langgraph_path]);
}

export function useAdsChat<TSelected = AdsSnapshot>(
  selector?: (snapshot: AdsSnapshot) => TSelected
): TSelected {
  const options = useAdsChatOptions();
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

/**
 * Returns chat actions with sendMessage guarded against empty messages.
 * Empty messages (whitespace-only) are blocked unless additional state is provided.
 * This prevents the Langgraph backend from becoming unresponsive when receiving
 * empty message payloads.
 */
export function useAdsChatActions() {
  return useAdsChat((s) => {
    const { sendMessage, ...rest } = s.actions;

    const guardedSendMessage: typeof sendMessage = (message, additionalState) => {
      const hasMessage = message.trim().length > 0;
      const hasAdditionalState = additionalState && Object.keys(additionalState).length > 0;

      if (!hasMessage && !hasAdditionalState) {
        console.warn("[useAdsChatActions] Blocked empty message submission");
        return;
      }

      sendMessage(message, additionalState);
    };

    return { sendMessage: guardedSendMessage, ...rest };
  });
}

export function useAdsChatThreadId() {
  return useAdsChat((s) => s.threadId);
}
