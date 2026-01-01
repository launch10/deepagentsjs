import { usePage } from "@inertiajs/react";
import { useMemo } from "react";
import { useLanggraph, type ChatSnapshot } from "langgraph-ai-sdk-react";
import type { AdsBridgeType, AdsGraphState } from "@shared";
import { Ads } from "@shared";
import type { CampaignProps } from "@components/ads/sidebar/workflow-buddy/ad-campaign.types";
import { useChatRegistration } from "./useChatRegistration";
import { UploadsAPIService } from "@rails_api_base";
import { validateFile } from "@types/attachment";

export type AdsSnapshot = ChatSnapshot<AdsGraphState>;

function useAdsChatOptions() {
  const { thread_id, jwt, langgraph_path, root_path } = usePage<CampaignProps>().props;

  return useMemo(() => {
    const url = new URL("api/ads/stream", langgraph_path).toString();
    const uploadService = new UploadsAPIService({ jwt, baseUrl: root_path });

    return {
      api: url,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      merge: Ads.MergeReducer as any,
      getInitialThreadId: () => (thread_id ? thread_id : undefined),
      // Composer attachments config - uploads return URLs directly
      attachments: {
        upload: async (file: File) => {
          const response = await uploadService.create({
            file,
            isLogo: false,
          });
          return { url: response.url };
        },
        validate: validateFile,
      },
    };
  }, [thread_id, jwt, langgraph_path, root_path]);
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

export function useAdsChatActions() {
  return useAdsChat((s) => s.actions);
}

export function useAdsChatThreadId() {
  return useAdsChat((s) => s.threadId);
}

/**
 * Returns the composer for managing message input.
 * Use composer.text, composer.setText, etc.
 */
export function useAdsChatComposer() {
  return useAdsChat((s) => s.composer);
}

/**
 * Returns whether the chat is currently streaming a response.
 */
export function useAdsChatIsStreaming() {
  return useAdsChat((s) => {
    const { status } = s;
    return status === "streaming" || status === "submitted";
  });
}
