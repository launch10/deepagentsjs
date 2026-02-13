import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import type { UseLanggraphOptions } from "langgraph-ai-sdk-react";
import type { Bridge } from "langgraph-ai-sdk-types";
import { UploadsAPIService } from "@rails_api_base";
import { validateFile } from "~/types/attachment";
import { useJwt, useLanggraphPath, useRootPath } from "~/stores/sessionStore";

/** Common page props for chat pages */
interface ChatPageProps {
  thread_id?: string;
  jwt?: string;
  langgraph_path?: string;
  root_path?: string;
}

export interface UseChatOptionsConfig<TBridge extends Bridge<any, any, any>> {
  /** API path relative to langgraph_path (e.g., "api/ads/stream") */
  apiPath: string;
  /** Optional merge reducer for state updates */
  merge?: UseLanggraphOptions<TBridge>["merge"];
  /** Optional callback when thread ID becomes available */
  onThreadIdAvailable?: UseLanggraphOptions<TBridge>["onThreadIdAvailable"];
  /** Custom getInitialThreadId implementation. Defaults to using thread_id prop. */
  getInitialThreadId?: () => string | undefined;
  /** Whether to include attachment upload config. Defaults to true. */
  includeAttachments?: boolean;
}

/**
 * Shared hook for creating langgraph chat options.
 * Reads directly from page props - simple and stable.
 *
 * @example
 * ```ts
 * function useWebsiteChatOptions() {
 *   return useChatOptions<WebsiteBridgeType>({ apiPath: "api/website/stream" });
 * }
 *
 * function useAdsChatOptions() {
 *   return useChatOptions<AdsBridgeType>({
 *     apiPath: "api/ads/stream",
 *     merge: Ads.MergeReducer,
 *   });
 * }
 * ```
 */
export function useChatOptions<TBridge extends Bridge<any, any, any>>(
  config: UseChatOptionsConfig<TBridge>
): UseLanggraphOptions<TBridge> {
  // thread_id is page-specific, always from props
  const page = usePage<ChatPageProps>();
  const { thread_id } = page.props;
  // Session-level values: prefer store (refreshed by useJwtRefresh),
  // fall back to page props on first render before store hydration
  const storeJwt = useJwt();
  const storeLanggraphPath = useLanggraphPath();
  const storeRootPath = useRootPath();
  const jwt = storeJwt ?? page.props.jwt;
  const langgraph_path = storeLanggraphPath ?? page.props.langgraph_path;
  const root_path = storeRootPath ?? page.props.root_path;
  const {
    apiPath,
    merge,
    onThreadIdAvailable,
    getInitialThreadId: customGetInitialThreadId,
    includeAttachments = true,
  } = config;

  return useMemo(() => {
    const url = langgraph_path ? new URL(apiPath, langgraph_path).toString() : "";
    const uploadService = includeAttachments
      ? new UploadsAPIService({ jwt: jwt ?? "", baseUrl: root_path ?? "" })
      : null;

    const options: UseLanggraphOptions<TBridge> = {
      api: url,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      getInitialThreadId: customGetInitialThreadId ?? (() => thread_id ?? undefined),
    };

    if (merge) {
      options.merge = merge;
    }

    if (onThreadIdAvailable) {
      options.onThreadIdAvailable = onThreadIdAvailable;
    }

    if (includeAttachments && uploadService) {
      options.attachments = {
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
      };
    }

    return options;
  }, [
    thread_id,
    jwt,
    langgraph_path,
    root_path,
    apiPath,
    merge,
    onThreadIdAvailable,
    customGetInitialThreadId,
    includeAttachments,
  ]);
}
