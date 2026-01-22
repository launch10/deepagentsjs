/**
 * Sync utilities for the project store.
 *
 * Note: Page props are now synced in SiteLayout, not in individual page components.
 * This file provides utilities for syncing Langgraph state to the project store.
 */
import { useEffect } from "react";
import { useProjectStore } from "./projectStore";

/**
 * Syncs a single Langgraph state key to the project store.
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
  const set = useProjectStore((s) => s.set);

  useEffect(() => {
    if (value !== undefined) {
      set({ [key]: value });
    }
  }, [key, value, set]);
}

/**
 * Resets the project store.
 * Call this when navigating away from a project context.
 */
export function useResetProject() {
  const reset = useProjectStore((s) => s.reset);
  return reset;
}
