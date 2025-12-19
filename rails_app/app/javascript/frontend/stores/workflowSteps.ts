import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { Workflow } from "@shared";

const WORKFLOW_STEPS = Workflow.workflows.launch.steps;
const AD_CAMPAIGN_SUBSTEP_ORDER = Workflow.AdCampaignSubstepNames;

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
  setSubstep: (substep: Workflow.SubstepName, returnToSection?: string | null) => void;
  syncFromUrl: () => void;
  syncCanGoBack: () => void;
  continue: () => void;
  back: () => void;
  returnToReview: () => void;
  clearReturnToSection: () => void;
};

export type WorkflowStepsStore = WorkflowStepsState & WorkflowStepsActions;

function getSubstepFromUrl(): Workflow.SubstepName | null {
  const path = window.location.pathname;
  const match = path.match(/\/campaigns\/(\w+)$/);
  const substep = match?.[1];
  return substep && AD_CAMPAIGN_SUBSTEP_ORDER.includes(substep as Workflow.AdCampaignSubstepName)
    ? (substep as Workflow.SubstepName)
    : null;
}

function pushUrl(projectUUID: string | null, substep: Workflow.SubstepName) {
  if (projectUUID) {
    window.history.pushState({}, "", `/projects/${projectUUID}/campaigns/${substep}`);
  }
}

const findPageIndex = (page: Workflow.WorkflowPage | null): number => {
  if (!page) return -1;
  return WORKFLOW_STEPS.findIndex((s) => s.name === page);
};

const findStepIndex = (step: Workflow.AdCampaignStepName | null): number | null => {
  if (!step) return null;
  return Workflow.AdCampaignStepNames.findIndex((s) => s === step);
};

const findSubstepIndex = (substep: Workflow.SubstepName | null): number | null => {
  if (!substep) return null;
  return Workflow.SubstepNames.findIndex((s) => s === substep);
};

export const createWorkflowStore = (
  initialState: Pick<WorkflowStepsState, "page" | "substep" | "projectUUID">
) => {
  const page = initialState.page;
  const substep = initialState.substep ?? null;
  const step = Workflow.deriveStep(substep);
  const pageNumber = findPageIndex(page);
  const stepNumber = findStepIndex(step);
  const substepNumber = findSubstepIndex(substep);
  // Initialize hasVisitedReview to true if starting on review page
  const hasVisitedReview = substep === "review";

  return createStore<WorkflowStepsStore>()(
    subscribeWithSelector((set, get) => ({
      name: "launch",
      steps: WORKFLOW_STEPS,
      page: page,
      step: step,
      substep: substep,
      projectUUID: initialState.projectUUID ?? null,
      pageNumber: pageNumber,
      stepNumber: stepNumber,
      substepNumber: substepNumber,
      canGoBack: false,
      canGoForward: false,
      hasVisitedReview: hasVisitedReview,
      returnToSection: null,

      setSubstep: (substep, returnToSection) => {
        const step = Workflow.deriveStep(substep);
        const stepNumber = findStepIndex(step);
        const substepNumber = findSubstepIndex(substep);
        const currentIndex = AD_CAMPAIGN_SUBSTEP_ORDER.indexOf(
          substep as Workflow.AdCampaignSubstepName
        );
        const canGoBack = currentIndex > 0;
        const canGoForward = currentIndex < AD_CAMPAIGN_SUBSTEP_ORDER.length - 1;
        // Set hasVisitedReview to true if navigating to review (once true, stays true)
        const hasVisitedReview = substep === "review" ? true : get().hasVisitedReview;
        // Store the section to scroll to when returning to review
        const newReturnToSection =
          returnToSection !== undefined ? returnToSection : get().returnToSection;
        set({
          substep,
          step,
          stepNumber,
          substepNumber,
          canGoBack,
          canGoForward,
          hasVisitedReview,
          returnToSection: newReturnToSection,
        });
        pushUrl(get().projectUUID, substep);
      },

      syncFromUrl: () => {
        const substep = getSubstepFromUrl();
        if (substep) {
          const step = Workflow.deriveStep(substep);
          const stepNumber = findStepIndex(step);
          const substepNumber = findSubstepIndex(substep);
          const currentIndex = AD_CAMPAIGN_SUBSTEP_ORDER.indexOf(
            substep as Workflow.AdCampaignSubstepName
          );
          const canGoBack = currentIndex > 0;
          const canGoForward = currentIndex < AD_CAMPAIGN_SUBSTEP_ORDER.length - 1;
          const hasVisitedReview = substep === "review" ? true : get().hasVisitedReview;
          set({
            substep,
            step,
            stepNumber,
            substepNumber,
            canGoBack,
            canGoForward,
            hasVisitedReview,
          });
        }
      },

      syncCanGoBack: () => {
        const { substep } = get();
        const currentIndex = substep
          ? AD_CAMPAIGN_SUBSTEP_ORDER.indexOf(substep as Workflow.AdCampaignSubstepName)
          : -1;
        const canGoBack = currentIndex > 0;
        const canGoForward = currentIndex < AD_CAMPAIGN_SUBSTEP_ORDER.length - 1;
        set({ canGoBack, canGoForward });
      },

      continue: () => {
        const { substep, projectUUID } = get();
        const currentIndex = substep
          ? AD_CAMPAIGN_SUBSTEP_ORDER.indexOf(substep as Workflow.AdCampaignSubstepName)
          : -1;
        const nextSubstep = AD_CAMPAIGN_SUBSTEP_ORDER[currentIndex + 1];
        if (nextSubstep) {
          const step = Workflow.deriveStep(nextSubstep);
          const stepNumber = findStepIndex(step);
          const substepNumber = findSubstepIndex(nextSubstep);
          const nextIndex = currentIndex + 1;
          const canGoBack = nextIndex > 0;
          const canGoForward = nextIndex < AD_CAMPAIGN_SUBSTEP_ORDER.length - 1;
          const hasVisitedReview = nextSubstep === "review" ? true : get().hasVisitedReview;
          set({
            substep: nextSubstep,
            step,
            stepNumber,
            substepNumber,
            canGoBack,
            canGoForward,
            hasVisitedReview,
          });
          pushUrl(projectUUID, nextSubstep);
        }
      },

      back: () => {
        const { substep, projectUUID } = get();
        const currentIndex = substep
          ? AD_CAMPAIGN_SUBSTEP_ORDER.indexOf(substep as Workflow.AdCampaignSubstepName)
          : -1;
        const prevSubstep = AD_CAMPAIGN_SUBSTEP_ORDER[currentIndex - 1];
        if (prevSubstep) {
          const step = Workflow.deriveStep(prevSubstep);
          const stepNumber = findStepIndex(step);
          const substepNumber = findSubstepIndex(prevSubstep);
          const prevIndex = currentIndex - 1;
          const canGoBack = prevIndex > 0;
          const canGoForward = prevIndex < AD_CAMPAIGN_SUBSTEP_ORDER.length - 1;
          set({ substep: prevSubstep, step, stepNumber, substepNumber, canGoBack, canGoForward });
          pushUrl(projectUUID, prevSubstep);
        }
      },

      returnToReview: () => {
        const { projectUUID } = get();
        const reviewSubstep = "review" as Workflow.SubstepName;
        const step = Workflow.deriveStep(reviewSubstep);
        const stepNumber = findStepIndex(step);
        const substepNumber = findSubstepIndex(reviewSubstep);
        const reviewIndex = AD_CAMPAIGN_SUBSTEP_ORDER.indexOf("review");
        const canGoBack = reviewIndex > 0;
        const canGoForward = reviewIndex < AD_CAMPAIGN_SUBSTEP_ORDER.length - 1;
        set({ substep: reviewSubstep, step, stepNumber, substepNumber, canGoBack, canGoForward });
        pushUrl(projectUUID, reviewSubstep);
      },

      clearReturnToSection: () => {
        set({ returnToSection: null });
      },
    }))
  );
};
