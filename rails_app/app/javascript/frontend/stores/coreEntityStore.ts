/**
 * Core Entity Store
 *
 * Single source of truth for core entity IDs (project, website, brainstorm, campaign).
 * Multiple sources can populate this store:
 *   - Page props (Inertia) on initial mount
 *   - Langgraph chat state (streaming updates)
 *   - React Query responses
 *
 * Components read from this store instead of trying to derive IDs from multiple sources.
 * This eliminates race conditions and stale closure issues.
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface CoreEntityState {
  projectId: number | null;
  projectUuid: string | null;
  websiteId: number | null;
  brainstormId: number | null;
  campaignId: number | null;
}

export interface CoreEntityActions {
  /** Set one or more entity IDs - merges with existing state */
  set: (updates: Partial<CoreEntityState>) => void;

  /** Reset all entity IDs to null (e.g., when navigating away) */
  reset: () => void;

  /** Set from page props - convenience method */
  setFromPageProps: (props: {
    project?: { id?: number; uuid?: string } | null;
    website?: { id?: number } | null;
    brainstorm?: { id?: number } | null;
    campaign?: { id?: number } | null;
  }) => void;

  /** Set from Langgraph state - convenience method */
  setFromLanggraphState: (state: {
    projectId?: number | null;
    websiteId?: number | null;
    brainstormId?: number | null;
    campaignId?: number | null;
  }) => void;
}

export type CoreEntityStore = CoreEntityState & CoreEntityActions;

const initialState: CoreEntityState = {
  projectId: null,
  projectUuid: null,
  websiteId: null,
  brainstormId: null,
  campaignId: null,
};

export const useCoreEntityStore = create<CoreEntityStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    set: (updates) =>
      set((state) => {
        // Only update if values actually changed
        const hasChanges = Object.entries(updates).some(
          ([key, value]) => state[key as keyof CoreEntityState] !== value
        );
        return hasChanges ? { ...state, ...updates } : state;
      }),

    reset: () => set(initialState),

    setFromPageProps: (props) => {
      const updates: Partial<CoreEntityState> = {};

      if (props.project?.id) {
        updates.projectId = props.project.id;
      }
      if (props.project?.uuid) {
        updates.projectUuid = props.project.uuid;
      }
      if (props.website?.id) {
        updates.websiteId = props.website.id;
      }
      if (props.brainstorm?.id) {
        updates.brainstormId = props.brainstorm.id;
      }
      if (props.campaign?.id) {
        updates.campaignId = props.campaign.id;
      }

      if (Object.keys(updates).length > 0) {
        set((state) => ({ ...state, ...updates }));
      }
    },

    setFromLanggraphState: (state) => {
      const updates: Partial<CoreEntityState> = {};

      if (state.projectId !== undefined) {
        updates.projectId = state.projectId;
      }
      if (state.websiteId !== undefined) {
        updates.websiteId = state.websiteId;
      }
      if (state.brainstormId !== undefined) {
        updates.brainstormId = state.brainstormId;
      }
      if (state.campaignId !== undefined) {
        updates.campaignId = state.campaignId;
      }

      if (Object.keys(updates).length > 0) {
        set((s) => ({ ...s, ...updates }));
      }
    },
  }))
);

// ============================================================================
// Selectors - use these in components for optimal re-renders
// ============================================================================

export const selectProjectId = (s: CoreEntityStore) => s.projectId;
export const selectProjectUuid = (s: CoreEntityStore) => s.projectUuid;
export const selectWebsiteId = (s: CoreEntityStore) => s.websiteId;
export const selectBrainstormId = (s: CoreEntityStore) => s.brainstormId;
export const selectCampaignId = (s: CoreEntityStore) => s.campaignId;
export const selectSet = (s: CoreEntityStore) => s.set;
export const selectReset = (s: CoreEntityStore) => s.reset;
export const selectSetFromPageProps = (s: CoreEntityStore) => s.setFromPageProps;
export const selectSetFromLanggraphState = (s: CoreEntityStore) => s.setFromLanggraphState;

// ============================================================================
// Convenience hooks - for common access patterns
// ============================================================================

export function useProjectId() {
  return useCoreEntityStore(selectProjectId);
}

export function useProjectUuid() {
  return useCoreEntityStore(selectProjectUuid);
}

export function useWebsiteId() {
  return useCoreEntityStore(selectWebsiteId);
}

export function useBrainstormId() {
  return useCoreEntityStore(selectBrainstormId);
}

export function useCampaignId() {
  return useCoreEntityStore(selectCampaignId);
}

export function useCoreEntityActions() {
  return useCoreEntityStore((s) => ({
    set: s.set,
    reset: s.reset,
    setFromPageProps: s.setFromPageProps,
    setFromLanggraphState: s.setFromLanggraphState,
  }));
}
