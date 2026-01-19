import { usePage } from "@inertiajs/react";
import { useMemo } from "react";
import { useLanggraph, type ChatSnapshot } from "langgraph-ai-sdk-react";
import type { WebsiteBridgeType, WebsiteGraphState, InertiaProps } from "@shared";
import { UploadsAPIService } from "@rails_api_base";
import { validateFile } from "~/types/attachment";

type WebsitePageProps =
  InertiaProps.paths["/projects/{uuid}/website"]["get"]["responses"]["200"]["content"]["application/json"];

export type WebsiteSnapshot = ChatSnapshot<WebsiteGraphState>;

function useWebsiteChatOptions() {
  const { thread_id, jwt, langgraph_path, root_path } = usePage<WebsitePageProps>().props;

  return useMemo(() => {
    const url = langgraph_path ? new URL("api/website/stream", langgraph_path).toString() : "";
    const uploadService = new UploadsAPIService({ jwt, baseUrl: root_path });

    return {
      api: url,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      getInitialThreadId: () => (thread_id ? thread_id : undefined),
      // Composer attachments config - uploads return URLs and original filename
      attachments: {
        upload: async (file: File) => {
          const response = await uploadService.create({
            file,
            isLogo: false,
          });
          return {
            url: response.url,
            meta: { filename: response.filename },
          };
        },
        validate: validateFile,
      },
    };
  }, [thread_id, jwt, langgraph_path, root_path]);
}

export function useWebsiteChat<TSelected = WebsiteSnapshot>(
  selector?: (snapshot: WebsiteSnapshot) => TSelected
): TSelected {
  const options = useWebsiteChatOptions();
  const snapshot = useLanggraph<WebsiteBridgeType>(options);

  return (selector ? selector(snapshot) : snapshot) as TSelected;
}

export function useWebsiteChatMessages() {
  return useWebsiteChat((s) => s.messages);
}

export function useWebsiteChatState<K extends keyof WebsiteGraphState>(key: K) {
  return useWebsiteChat((s) => s.state[key]);
}

export function useWebsiteChatFullState() {
  return useWebsiteChat((s) => s.state);
}

export function useWebsiteChatStatus() {
  return useWebsiteChat((s) => s.status);
}

export function useWebsiteChatIsLoading() {
  return useWebsiteChat((s) => s.isLoading);
}

export function useWebsiteChatIsLoadingHistory() {
  return useWebsiteChat((s) => s.isLoadingHistory);
}

export function useWebsiteChatActions() {
  return useWebsiteChat((s) => s.actions);
}

export function useWebsiteChatThreadId() {
  return useWebsiteChat((s) => s.threadId);
}

/**
 * Returns the composer for managing message input.
 * Use composer.text, composer.setText, etc.
 */
export function useWebsiteChatComposer() {
  return useWebsiteChat((s) => s.composer);
}

/**
 * Returns whether the chat is currently streaming a response.
 */
export function useWebsiteChatIsStreaming() {
  return useWebsiteChat((s) => {
    const { status } = s;
    return status === "streaming" || status === "submitted";
  });
}
