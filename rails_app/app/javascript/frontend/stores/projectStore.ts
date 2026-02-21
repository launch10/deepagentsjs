/**
 * Project Store
 *
 * Single source of truth for current project context (project, website, brainstorm, campaign).
 * Multiple sources can populate this store:
 *   - Page props (Inertia) via SiteLayout on initial mount
 *   - Langgraph chat state (streaming updates)
 *   - React Query responses
 *
 * Components read from this store instead of trying to derive IDs from multiple sources.
 * This eliminates race conditions and stale closure issues.
 *
 * Resets when URL changes (handled in SiteLayout).
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface ProjectState {
  projectId: number | null;
  projectUuid: string | null;
  websiteId: number | null;
  brainstormId: number | null;
  campaignId: number | null;
  deployId: number | null;
  threadId: string | null;
}

export interface ProjectActions {
  /** Set one or more IDs - merges with existing state */
  set: (updates: Partial<ProjectState>) => void;

  /** Reset all IDs to null (called by SiteLayout on URL change) */
  reset: () => void;

  /** Set from page props - convenience method */
  setFromPageProps: (props: {
    project?: { id?: number; uuid?: string } | null;
    website?: { id?: number } | null;
    brainstorm?: { id?: number } | null;
    campaign?: { id?: number } | null;
    deploy?: { id?: number } | null;
    thread_id?: string | null;
  }) => void;

  /** Set from Langgraph state - convenience method */
  setFromLanggraphState: (state: {
    projectId?: number | null;
    websiteId?: number | null;
    brainstormId?: number | null;
    campaignId?: number | null;
    deployId?: number | null;
  }) => void;
}

export type ProjectStore = ProjectState & ProjectActions;

const initialState: ProjectState = {
  projectId: null,
  projectUuid: null,
  websiteId: null,
  brainstormId: null,
  campaignId: null,
  deployId: null,
  threadId: null,
};

export const useProjectStore = create<ProjectStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    set: (updates) =>
      set((state) => {
        // Only update if values actually changed
        const hasChanges = Object.entries(updates).some(
          ([key, value]) => state[key as keyof ProjectState] !== value
        );
        return hasChanges ? { ...state, ...updates } : state;
      }),

    reset: () => set(initialState),

    setFromPageProps: (props) => {
      const updates: Partial<ProjectState> = {};

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
      if (props.deploy?.id) {
        updates.deployId = props.deploy.id;
      }
      if (props.thread_id !== undefined) {
        updates.threadId = props.thread_id ?? null;
      }

      if (Object.keys(updates).length > 0) {
        set((state) => ({ ...state, ...updates }));
      }
    },

    setFromLanggraphState: (state) => {
      const updates: Partial<ProjectState> = {};

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
      if (state.deployId !== undefined) {
        updates.deployId = state.deployId;
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

export const selectProjectId = (s: ProjectStore) => s.projectId;
export const selectProjectUuid = (s: ProjectStore) => s.projectUuid;
export const selectWebsiteId = (s: ProjectStore) => s.websiteId;
export const selectBrainstormId = (s: ProjectStore) => s.brainstormId;
export const selectCampaignId = (s: ProjectStore) => s.campaignId;
export const selectDeployId = (s: ProjectStore) => s.deployId;
export const selectThreadId = (s: ProjectStore) => s.threadId;

// ============================================================================
// Convenience hooks - for common access patterns
// ============================================================================

export function useProjectId() {
  return useProjectStore(selectProjectId);
}

export function useProjectUuid() {
  return useProjectStore(selectProjectUuid);
}

export function useWebsiteId() {
  return useProjectStore(selectWebsiteId);
}

export function useBrainstormId() {
  return useProjectStore(selectBrainstormId);
}

export function useCampaignId() {
  return useProjectStore(selectCampaignId);
}

export function useDeployId() {
  return useProjectStore(selectDeployId);
}

export function useThreadId() {
  return useProjectStore(selectThreadId);
}

export function useProjectActions() {
  return useProjectStore((s) => ({
    set: s.set,
    reset: s.reset,
    setFromPageProps: s.setFromPageProps,
    setFromLanggraphState: s.setFromLanggraphState,
  }));
}
