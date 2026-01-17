/**
 * URL-as-Truth Workflow Store
 *
 * Key principle: URL is the single source of truth for navigation state.
 * The store derives its state from the URL and actions change the URL.
 *
 * This replaces the old workflowSteps.ts which had multiple sources of truth
 * (Inertia props, chat state, URL) requiring complex sync logic.
 */
import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { router } from "@inertiajs/react";
import { Workflow } from "@shared";
import {
  getPageIndex,
  continueWorkflow,
  backWorkflow,
  type WorkflowPosition,
} from "@lib/workflowNavigation";

/**
 * Parse URL to get current workflow state - this is the source of truth
 */
export function parseUrl(): {
  projectUUID: string | null;
  page: Workflow.WorkflowPage | null;
  substep: Workflow.SubstepName | null;
} {
  const path = window.location.pathname;

  // Match /projects/{uuid}/brainstorm
  const brainstormMatch = path.match(/^\/projects\/([^/]+)\/brainstorm$/);
  if (brainstormMatch) {
    return { projectUUID: brainstormMatch[1], page: "brainstorm", substep: null };
  }

  // Match /projects/{uuid}/website
  const websiteMatch = path.match(/^\/projects\/([^/]+)\/website$/);
  if (websiteMatch) {
    return { projectUUID: websiteMatch[1], page: "website", substep: null };
  }

  // Match /projects/{uuid}/campaigns/{substep}
  const campaignsMatch = path.match(/^\/projects\/([^/]+)\/campaigns\/(\w+)$/);
  if (campaignsMatch) {
    const substep = campaignsMatch[2] as Workflow.AdCampaignSubstepName;
    if (Workflow.AdCampaignSubstepNames.includes(substep)) {
      return { projectUUID: campaignsMatch[1], page: "ad_campaign", substep };
    }
  }

  // Match /projects/{uuid}/deploy (no substeps)
  const deployMatch = path.match(/^\/projects\/([^/]+)\/deploy$/);
  if (deployMatch) {
    return { projectUUID: deployMatch[1], page: "deploy", substep: null };
  }

  return { projectUUID: null, page: null, substep: null };
}

/**
 * Build URL for a given workflow position
 */
function buildUrl(
  page: Workflow.WorkflowPage,
  substep: Workflow.SubstepName | null,
  projectUUID: string
): string {
  switch (page) {
    case "brainstorm":
      return `/projects/${projectUUID}/brainstorm`;
    case "website":
      return `/projects/${projectUUID}/website`;
    case "ad_campaign":
      return `/projects/${projectUUID}/campaigns/${substep}`;
    case "deploy":
      return `/projects/${projectUUID}/deploy`;
  }
}

// Re-export for convenience
export { getPageIndex };

export interface WorkflowState {
  projectUUID: string | null;
  page: Workflow.WorkflowPage | null;
  substep: Workflow.SubstepName | null;
  /** True once user has visited the review page - enables "Return to Review" button */
  hasVisitedReview: boolean;
  /** Section ID to scroll to when returning to review page */
  returnToSection: string | null;
}

export interface WorkflowActions {
  /** Sync state from current URL - called on mount and popstate */
  syncFromUrl: () => void;

  /** Navigate to a specific page/substep */
  navigate: (
    page: Workflow.WorkflowPage,
    substep?: Workflow.SubstepName | null,
    projectUUID?: string
  ) => void;

  /** Continue to next step in workflow */
  continue: () => void;

  /** Go back to previous step in workflow */
  back: () => void;

  /** Navigate directly to the review page */
  returnToReview: () => void;

  /** Set the section to scroll to when returning to review */
  setReturnToSection: (section: string | null) => void;

  /** Clear the returnToSection state */
  clearReturnToSection: () => void;

  /** Set substep with optional returnToSection (convenience method) */
  setSubstep: (substep: Workflow.SubstepName, returnToSection?: string | null) => void;
}

export type WorkflowStore = WorkflowState & WorkflowActions;

export const createWorkflowStore = () => {
  const initial = parseUrl();
  const hasVisitedReview = initial.substep === "review";

  return createStore<WorkflowStore>()(
    subscribeWithSelector((set, get) => ({
      ...initial,
      hasVisitedReview,
      returnToSection: null,

      syncFromUrl: () => {
        const parsed = parseUrl();
        const hasVisitedReview = parsed.substep === "review" ? true : get().hasVisitedReview;
        set({ ...parsed, hasVisitedReview });
      },

      navigate: (page, substep = null, projectUUID) => {
        const uuid = projectUUID ?? get().projectUUID;
        if (!uuid) {
          console.error("Cannot navigate without projectUUID");
          return;
        }

        const currentPage = get().page;
        const url = buildUrl(page, substep, uuid);
        const hasVisitedReview = substep === "review" ? true : get().hasVisitedReview;

        // Cross-page navigation needs Inertia (component swap)
        // Same-page substep navigation uses pushState
        if (page !== currentPage) {
          // Update hasVisitedReview before navigation
          if (hasVisitedReview !== get().hasVisitedReview) {
            set({ hasVisitedReview });
          }
          router.visit(url);
        } else {
          window.history.pushState({}, "", url);
          set({ page, substep, projectUUID: uuid, hasVisitedReview });
        }
      },

      continue: () => {
        const { page, substep, projectUUID } = get();

        // If no projectUUID in store, try to get from URL
        // (handles case where chat just did pushState)
        let uuid = projectUUID;
        if (!uuid) {
          const parsed = parseUrl();
          uuid = parsed.projectUUID;
          if (uuid) {
            set({ projectUUID: uuid });
          }
        }

        if (!uuid) {
          console.error("Cannot continue without projectUUID");
          return;
        }

        const current: WorkflowPosition = { page, substep };
        const next = continueWorkflow(current);

        // Don't navigate if we're at the end
        if (next.page === page && next.substep === substep) return;

        get().navigate(next.page!, next.substep, uuid);
      },

      back: () => {
        const { page, substep, projectUUID } = get();
        if (!projectUUID) {
          console.error("Cannot go back without projectUUID");
          return;
        }

        const current: WorkflowPosition = { page, substep };
        const prev = backWorkflow(current);

        // Don't navigate if we're at the beginning
        if (prev.page === page && prev.substep === substep) return;

        get().navigate(prev.page!, prev.substep, projectUUID);
      },

      returnToReview: () => {
        const { projectUUID } = get();
        if (!projectUUID) {
          console.error("Cannot return to review without projectUUID");
          return;
        }
        get().navigate("ad_campaign", "review", projectUUID);
      },

      setReturnToSection: (section) => {
        set({ returnToSection: section });
      },

      clearReturnToSection: () => {
        set({ returnToSection: null });
      },

      setSubstep: (substep, returnToSection) => {
        const { page, projectUUID } = get();
        if (returnToSection !== undefined) {
          set({ returnToSection });
        }
        if (page && projectUUID) {
          get().navigate(page, substep, projectUUID);
        }
      },
    }))
  );
};

// Computed selectors (not stored state)
export const selectCanGoBack = (s: WorkflowState): boolean => {
  const prev = backWorkflow({ page: s.page, substep: s.substep });
  return prev.page !== s.page || prev.substep !== s.substep;
};

export const selectCanGoForward = (s: WorkflowState): boolean => {
  const next = continueWorkflow({ page: s.page, substep: s.substep });
  return next.page !== s.page || next.substep !== s.substep;
};

export const selectPageNumber = (s: WorkflowState): number => getPageIndex(s.page);

export const selectPage = (s: WorkflowStore) => s.page;
export const selectSubstep = (s: WorkflowStore) => s.substep;
export const selectProjectUUID = (s: WorkflowStore) => s.projectUUID;
export const selectNavigate = (s: WorkflowStore) => s.navigate;
export const selectContinue = (s: WorkflowStore) => s.continue;
export const selectBack = (s: WorkflowStore) => s.back;
export const selectHasVisitedReview = (s: WorkflowStore) => s.hasVisitedReview;
export const selectReturnToSection = (s: WorkflowStore) => s.returnToSection;
export const selectReturnToReview = (s: WorkflowStore) => s.returnToReview;
export const selectSetReturnToSection = (s: WorkflowStore) => s.setReturnToSection;
export const selectClearReturnToSection = (s: WorkflowStore) => s.clearReturnToSection;
export const selectSetSubstep = (s: WorkflowStore) => s.setSubstep;

// Computed selector: derive step from substep
export const selectStep = (s: WorkflowState): Workflow.AdCampaignStepName | null => {
  return Workflow.deriveStep(s.substep);
};

// The workflow steps (pages) - static, doesn't depend on state
export const WORKFLOW_STEPS = Workflow.workflows.launch.steps;
export const selectPages = (_s: WorkflowState) => WORKFLOW_STEPS;
