/**
 * Sync hook for populating the core entity store from various sources.
 *
 * Use this in page components to ensure the store is populated with
 * entity IDs from page props and Langgraph state.
 *
 * Note: The store is reset globally in SiteLayout when URL changes (during render,
 * before children render). This hook hydrates once per URL.
 */
import { useEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import { useCoreEntityStore } from "./coreEntityStore";

// Page props can have various shapes - we extract what we need
type PagePropsSource = Record<string, unknown> & {
  project?: { id?: number; uuid?: string } | null;
  website?: { id?: number } | null;
  brainstorm?: { id?: number } | null;
  campaign?: { id?: number } | null;
};

/**
 * Syncs page props to the core entity store once per URL.
 *
 * The store is reset in SiteLayout during render when URL changes.
 * This hook tracks which URL it hydrated for, so it re-hydrates
 * if the URL changes (e.g., browser back/forward with cached component).
 */
export function useSyncPageProps(props: PagePropsSource | null | undefined) {
  const setFromPageProps = useCoreEntityStore((s) => s.setFromPageProps);
  const { url } = usePage();
  const hydratedForUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Already hydrated for this URL - skip
    if (hydratedForUrlRef.current === url) {
      console.log("[useSyncPageProps] Already hydrated for URL, skipping", { url });
      return;
    }
    if (!props) {
      console.log("[useSyncPageProps] No props, skipping", { url });
      return;
    }

    const projectId = (props?.project as { id?: number } | null | undefined)?.id;
    const projectUuid = (props?.project as { uuid?: string } | null | undefined)?.uuid;
    const websiteId = (props?.website as { id?: number } | null | undefined)?.id;
    const brainstormId = (props?.brainstorm as { id?: number } | null | undefined)?.id;
    const campaignId = (props?.campaign as { id?: number } | null | undefined)?.id;

    console.log("[useSyncPageProps] Hydrating from page props", {
      url,
      projectId,
      projectUuid,
      websiteId,
      brainstormId,
      campaignId,
    });

    setFromPageProps({
      project: projectId || projectUuid ? { id: projectId, uuid: projectUuid } : null,
      website: websiteId ? { id: websiteId } : null,
      brainstorm: brainstormId ? { id: brainstormId } : null,
      campaign: campaignId ? { id: campaignId } : null,
    });

    hydratedForUrlRef.current = url;
  }, [url, props, setFromPageProps]);
}

/**
 * Syncs a single Langgraph state key to the core entity store.
 * Use this inside chat hooks to publish entity IDs as they change.
 *
 * @example
 * // Inside useBrainstormChat or a wrapper:
 * const websiteId = useBrainstormChatState("websiteId");
 * syncLanggraphToStore("websiteId", websiteId);
 */
export function syncLanggraphToStore(
  key: "projectId" | "websiteId" | "brainstormId" | "campaignId",
  value: any
) {
  const set = useCoreEntityStore((s) => s.set);

  useEffect(() => {
    if (value !== undefined) {
      set({ [key]: value });
    }
  }, [key, value, set]);
}

/**
 * Resets the core entity store.
 * Call this when navigating away from a project context.
 */
export function useResetCoreEntities() {
  const reset = useCoreEntityStore((s) => s.reset);
  return reset;
}
