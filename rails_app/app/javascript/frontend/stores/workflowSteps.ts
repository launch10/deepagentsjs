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

function deriveSubstepState(substep: Workflow.SubstepName | null) {
  const step = Workflow.deriveStep(substep);
  const stepNumber = step ? Workflow.AdCampaignStepNames.indexOf(step) : null;
  const substepNumber = substep ? Workflow.SubstepNames.indexOf(substep) : null;
  const currentIndex = substep
    ? AD_CAMPAIGN_SUBSTEP_ORDER.indexOf(substep as Workflow.AdCampaignSubstepName)
    : -1;
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex >= 0 && currentIndex < AD_CAMPAIGN_SUBSTEP_ORDER.length - 1;

  return { step, stepNumber, substepNumber, canGoBack, canGoForward };
}

export const createWorkflowStore = (
  initialState: Pick<WorkflowStepsState, "page" | "substep" | "projectUUID">
) => {
  const page = initialState.page;
  const substep = initialState.substep ?? null;
  const pageNumber = page ? WORKFLOW_STEPS.findIndex((s) => s.name === page) : -1;
  const derived = deriveSubstepState(substep);
  const hasVisitedReview = substep === "review";

  return createStore<WorkflowStepsStore>()(
    subscribeWithSelector((set, get) => ({
      steps: WORKFLOW_STEPS,
      page,
      substep,
      projectUUID: initialState.projectUUID ?? null,
      pageNumber,
      ...derived,
      hasVisitedReview,
      returnToSection: null,

      setSubstep: (substep, returnToSection) => {
        const hasVisitedReview = substep === "review" ? true : get().hasVisitedReview;
        const newReturnToSection =
          returnToSection !== undefined ? returnToSection : get().returnToSection;
        set({
          substep,
          ...deriveSubstepState(substep),
          hasVisitedReview,
          returnToSection: newReturnToSection,
        });
        pushUrl(get().projectUUID, substep);
      },

      syncFromUrl: () => {
        const substep = getSubstepFromUrl();
        if (substep) {
          const hasVisitedReview = substep === "review" ? true : get().hasVisitedReview;
          set({ substep, ...deriveSubstepState(substep), hasVisitedReview });
        }
      },

      continue: () => {
        const { substep, projectUUID } = get();
        const currentIndex = substep
          ? AD_CAMPAIGN_SUBSTEP_ORDER.indexOf(substep as Workflow.AdCampaignSubstepName)
          : -1;
        const nextSubstep = AD_CAMPAIGN_SUBSTEP_ORDER[currentIndex + 1];
        if (nextSubstep) {
          const hasVisitedReview = nextSubstep === "review" ? true : get().hasVisitedReview;
          set({ substep: nextSubstep, ...deriveSubstepState(nextSubstep), hasVisitedReview });
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
          set({ substep: prevSubstep, ...deriveSubstepState(prevSubstep) });
          pushUrl(projectUUID, prevSubstep);
        }
      },

      returnToReview: () => {
        const { projectUUID } = get();
        const reviewSubstep = "review" as Workflow.SubstepName;
        set({ substep: reviewSubstep, ...deriveSubstepState(reviewSubstep) });
        pushUrl(projectUUID, reviewSubstep);
      },

      clearReturnToSection: () => {
        set({ returnToSection: null });
      },
    }))
  );
};
