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

const WORKFLOW_STEPS = Workflow.workflows.launch.steps;

export type WorkflowStepsState = {
  steps: Readonly<Workflow.Step[]>;
  page: Workflow.WorkflowPage | null;
  step: Workflow.AdCampaignStepName | null;
  substep: Workflow.SubstepName | null;
  pageNumber: number;
  stepNumber: number | null;
  substepNumber: number | null;
  projectUUID: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  /** True once user has visited the review page - enables "Return to Review" button */
  hasVisitedReview: boolean;
  /** Section ID to scroll to when returning to review page */
  returnToSection: string | null;
};

export type WorkflowStepsActions = {
  /**
   * Set the current page and optionally projectUUID.
   * Pushes URL to history if pushHistory is true (default).
   */
  setPage: (page: Workflow.WorkflowPage, projectUUID?: string, pushHistory?: boolean) => void;
  /**
   * Set the current substep and update URL.
   */
  setSubstep: (substep: Workflow.SubstepName, returnToSection?: string | null) => void;
  /**
   * Clear workflow state (used when navigating to / or /projects/new)
   */
  clear: () => void;
  /**
   * Sync state from current URL (for popstate handling)
   */
  syncFromUrl: () => void;
  /**
   * Continue to the next step in the workflow.
   * Works across all pages, not just ad_campaign.
   */
  continue: () => void;
  /**
   * Go back to the previous step in the workflow.
   * Works across all pages, not just ad_campaign.
   */
  back: () => void;
  /**
   * Navigate directly to the review page
   */
  returnToReview: () => void;
  /**
   * Clear the returnToSection state
   */
  clearReturnToSection: () => void;
};

export type WorkflowStepsStore = WorkflowStepsState & WorkflowStepsActions;

/**
 * Compute the URL for a given workflow position.
 * This is the single source of truth for URL generation.
 *
 * URL patterns:
 * - brainstorm: /projects/{uuid}/brainstorm
 * - website: /projects/{uuid}/website
 * - ad_campaign: /projects/{uuid}/campaigns/{substep}
 * - launch: /projects/{uuid}/launch/{substep}
 */
export function getWorkflowUrl(
  page: Workflow.WorkflowPage | null,
  substep: Workflow.SubstepName | null,
  projectUUID: string | null
): string | null {
  if (!projectUUID || !page) return null;

  switch (page) {
    case "brainstorm":
      return `/projects/${projectUUID}/brainstorm`;
    case "website":
      return `/projects/${projectUUID}/website`;
    case "ad_campaign":
      return substep ? `/projects/${projectUUID}/campaigns/${substep}` : null;
    case "launch":
      return substep ? `/projects/${projectUUID}/launch/${substep}` : null;
    default:
      return null;
  }
}

/**
 * Push URL to browser history
 */
function pushUrl(url: string | null) {
  if (url) {
    window.history.pushState({}, "", url);
  }
}

/**
 * Parse workflow position from current URL
 */
function parseUrlToPosition(): Partial<WorkflowPosition> & { projectUUID?: string } {
  const path = window.location.pathname;

  // Match /projects/{uuid}/brainstorm
  const brainstormMatch = path.match(/^\/projects\/([^/]+)\/brainstorm$/);
  if (brainstormMatch) {
    return { page: "brainstorm", substep: null, projectUUID: brainstormMatch[1] };
  }

  // Match /projects/{uuid}/website
  const websiteMatch = path.match(/^\/projects\/([^/]+)\/website$/);
  if (websiteMatch) {
    return { page: "website", substep: null, projectUUID: websiteMatch[1] };
  }

  // Match /projects/{uuid}/campaigns/{substep}
  const campaignsMatch = path.match(/^\/projects\/([^/]+)\/campaigns\/(\w+)$/);
  if (campaignsMatch) {
    const substep = campaignsMatch[2] as Workflow.AdCampaignSubstepName;
    if (Workflow.AdCampaignSubstepNames.includes(substep)) {
      return { page: "ad_campaign", substep, projectUUID: campaignsMatch[1] };
    }
  }

  // Match /projects/{uuid}/launch/{substep}
  const launchMatch = path.match(/^\/projects\/([^/]+)\/launch\/(\w+)$/);
  if (launchMatch) {
    const substep = launchMatch[2] as Workflow.LaunchSubstepName;
    if (Workflow.LaunchSubstepNames.includes(substep)) {
      return { page: "launch", substep, projectUUID: launchMatch[1] };
    }
  }

  return { page: null, substep: null };
}

/**
 * Derive computed state from substep
 */
function deriveSubstepState(substep: Workflow.SubstepName | null) {
  const step = Workflow.deriveStep(substep);
  const stepNumber = step ? Workflow.AdCampaignStepNames.indexOf(step) : null;
  const substepNumber = substep ? Workflow.SubstepNames.indexOf(substep) : null;

  return { step, stepNumber, substepNumber };
}

/**
 * Derive navigation state (can go back/forward) from position
 */
function deriveNavigationState(page: Workflow.WorkflowPage | null, substep: Workflow.SubstepName | null) {
  const position: WorkflowPosition = { page, substep };
  const next = continueWorkflow(position);
  const prev = backWorkflow(position);

  // Can go forward if continue returns a different position
  const canGoForward = next.page !== position.page || next.substep !== position.substep;
  // Can go back if back returns a different position
  const canGoBack = prev.page !== position.page || prev.substep !== position.substep;

  return { canGoBack, canGoForward };
}

export const createWorkflowStore = (
  initialState: Pick<WorkflowStepsState, "page" | "substep" | "projectUUID">
) => {
  const page = initialState.page;
  const substep = initialState.substep ?? null;
  const pageNumber = getPageIndex(page);
  const derivedSubstep = deriveSubstepState(substep);
  const derivedNav = deriveNavigationState(page, substep);
  const hasVisitedReview = substep === "review";

  return createStore<WorkflowStepsStore>()(
    subscribeWithSelector((set, get) => ({
      steps: WORKFLOW_STEPS,
      page,
      substep,
      projectUUID: initialState.projectUUID ?? null,
      pageNumber,
      ...derivedSubstep,
      ...derivedNav,
      hasVisitedReview,
      returnToSection: null,

      setPage: (page, projectUUID, pushHistory = true) => {
        const currentUUID = projectUUID ?? get().projectUUID;
        const newPageNumber = getPageIndex(page);
        const derivedNav = deriveNavigationState(page, null);

        set({
          page,
          pageNumber: newPageNumber,
          substep: null, // Reset substep when changing page
          ...deriveSubstepState(null),
          ...derivedNav,
          ...(projectUUID !== undefined ? { projectUUID } : {}),
        });

        if (pushHistory) {
          const url = getWorkflowUrl(page, null, currentUUID);
          pushUrl(url);
        }
      },

      setSubstep: (substep, returnToSection) => {
        const { page, projectUUID } = get();
        const hasVisitedReview = substep === "review" ? true : get().hasVisitedReview;
        const newReturnToSection =
          returnToSection !== undefined ? returnToSection : get().returnToSection;
        const derivedNav = deriveNavigationState(page, substep);

        set({
          substep,
          ...deriveSubstepState(substep),
          ...derivedNav,
          hasVisitedReview,
          returnToSection: newReturnToSection,
        });

        const url = getWorkflowUrl(page, substep, projectUUID);
        pushUrl(url);
      },

      clear: () => {
        set({
          page: null,
          substep: null,
          projectUUID: null,
          pageNumber: -1,
          step: null,
          stepNumber: null,
          substepNumber: null,
          canGoBack: false,
          canGoForward: false,
          hasVisitedReview: false,
          returnToSection: null,
        });
      },

      syncFromUrl: () => {
        const parsed = parseUrlToPosition();
        if (parsed.page) {
          const hasVisitedReview = parsed.substep === "review" ? true : get().hasVisitedReview;
          const derivedNav = deriveNavigationState(parsed.page, parsed.substep ?? null);
          set({
            page: parsed.page,
            substep: parsed.substep ?? null,
            pageNumber: getPageIndex(parsed.page),
            ...deriveSubstepState(parsed.substep ?? null),
            ...derivedNav,
            hasVisitedReview,
            ...(parsed.projectUUID ? { projectUUID: parsed.projectUUID } : {}),
          });
        }
      },

      continue: () => {
        let { page, substep, projectUUID } = get();

        // If projectUUID is missing, try to sync from URL (handles pushState navigation)
        if (!projectUUID) {
          const parsed = parseUrlToPosition();
          if (parsed.projectUUID) {
            projectUUID = parsed.projectUUID;
            set({ projectUUID });
          }
          if (parsed.page) {
            page = parsed.page;
          }
        }

        const current: WorkflowPosition = { page, substep };
        const next = continueWorkflow(current);

        // Don't do anything if we're at the end
        if (next.page === page && next.substep === substep) return;

        const url = getWorkflowUrl(next.page, next.substep, projectUUID);
        if (!url) return;

        // Crossing page boundaries requires Inertia navigation (full component swap)
        // Substep navigation within same page uses pushState (no server round-trip)
        const crossingPageBoundary = next.page !== page;

        if (crossingPageBoundary) {
          // Let Inertia handle the navigation - store will sync from new props
          router.visit(url);
        } else {
          // Same page, just update substep with pushState
          const hasVisitedReview = next.substep === "review" ? true : get().hasVisitedReview;
          const derivedNav = deriveNavigationState(next.page, next.substep);

          set({
            page: next.page,
            substep: next.substep,
            pageNumber: getPageIndex(next.page),
            ...deriveSubstepState(next.substep),
            ...derivedNav,
            hasVisitedReview,
          });

          pushUrl(url);
        }
      },

      back: () => {
        const { page, substep, projectUUID } = get();
        const current: WorkflowPosition = { page, substep };
        const prev = backWorkflow(current);

        // Don't do anything if we're at the beginning
        if (prev.page === page && prev.substep === substep) return;

        const url = getWorkflowUrl(prev.page, prev.substep, projectUUID);
        if (!url) return;

        // Crossing page boundaries requires Inertia navigation (full component swap)
        // Substep navigation within same page uses pushState (no server round-trip)
        const crossingPageBoundary = prev.page !== page;

        if (crossingPageBoundary) {
          router.visit(url);
        } else {
          const derivedNav = deriveNavigationState(prev.page, prev.substep);

          set({
            page: prev.page,
            substep: prev.substep,
            pageNumber: getPageIndex(prev.page),
            ...deriveSubstepState(prev.substep),
            ...derivedNav,
          });

          pushUrl(url);
        }
      },

      returnToReview: () => {
        const { page, projectUUID } = get();
        // Review is only in ad_campaign
        const reviewSubstep = "review" as Workflow.SubstepName;
        const derivedNav = deriveNavigationState("ad_campaign", reviewSubstep);

        set({
          page: "ad_campaign",
          substep: reviewSubstep,
          pageNumber: getPageIndex("ad_campaign"),
          ...deriveSubstepState(reviewSubstep),
          ...derivedNav,
        });

        const url = getWorkflowUrl("ad_campaign", reviewSubstep, projectUUID);
        pushUrl(url);
      },

      clearReturnToSection: () => {
        set({ returnToSection: null });
      },
    }))
  );
};
