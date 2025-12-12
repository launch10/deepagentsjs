import { createStore } from "zustand";
import { Workflow } from "@shared";

const WORKFLOW_STEPS = Workflow.workflows.launch.steps;
const SUBSTEP_ORDER = Workflow.SubstepNames;

export type WorkflowStepsState = {
  steps: Readonly<Workflow.Step[]>;
  page: Workflow.WorkflowPage | null;
  step: Workflow.AdCampaignStepName | null;
  substep: Workflow.SubstepName | null;
  pageNumber: number;
  stepNumber: number | null;
  substepNumber: number | null;
  projectUUID: string | null;
};

export type WorkflowStepsActions = {
  setSubstep: (substep: Workflow.SubstepName) => void;
  syncFromUrl: () => void;
  continue: () => void;
  back: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
};

export type WorkflowStepsStore = WorkflowStepsState & WorkflowStepsActions;

function getSubstepFromUrl(): Workflow.SubstepName | null {
  const path = window.location.pathname;
  const match = path.match(/\/campaigns\/(\w+)$/);
  const substep = match?.[1];
  return substep && SUBSTEP_ORDER.includes(substep as Workflow.SubstepName)
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

  return createStore<WorkflowStepsStore>((set, get) => ({
    name: "launch",
    steps: WORKFLOW_STEPS,
    page: page,
    step: step,
    substep: substep,
    projectUUID: initialState.projectUUID ?? null,
    pageNumber: pageNumber,
    stepNumber: stepNumber,
    substepNumber: substepNumber,

    setSubstep: (substep) => {
      const step = Workflow.deriveStep(substep);
      const stepNumber = findStepIndex(step);
      const substepNumber = findSubstepIndex(substep);
      set({ substep, step, stepNumber, substepNumber });
      pushUrl(get().projectUUID, substep);
    },

    syncFromUrl: () => {
      const substep = getSubstepFromUrl();
      if (substep) {
        const step = Workflow.deriveStep(substep);
        const stepNumber = findStepIndex(step);
        const substepNumber = findSubstepIndex(substep);
        set({ substep, step, stepNumber, substepNumber });
      }
    },

    continue: () => {
      const { substep, projectUUID } = get();
      const currentIndex = substep ? SUBSTEP_ORDER.indexOf(substep) : -1;
      const nextSubstep = SUBSTEP_ORDER[currentIndex + 1];
      if (nextSubstep) {
        const step = Workflow.deriveStep(nextSubstep);
        const stepNumber = findStepIndex(step);
        const substepNumber = findSubstepIndex(nextSubstep);
        set({ substep: nextSubstep, step, stepNumber, substepNumber });
        pushUrl(projectUUID, nextSubstep);
      }
    },

    back: () => {
      const { substep, projectUUID } = get();
      const currentIndex = substep ? SUBSTEP_ORDER.indexOf(substep) : -1;
      const prevSubstep = SUBSTEP_ORDER[currentIndex - 1];
      if (prevSubstep) {
        const step = Workflow.deriveStep(prevSubstep);
        const stepNumber = findStepIndex(step);
        const substepNumber = findSubstepIndex(prevSubstep);
        set({ substep: prevSubstep, step, stepNumber, substepNumber });
        pushUrl(projectUUID, prevSubstep);
      }
    },

    canGoBack: () => {
      const { substep } = get();
      const currentIndex = substep ? SUBSTEP_ORDER.indexOf(substep) : -1;
      return currentIndex > 0;
    },

    canGoForward: () => {
      const { substep } = get();
      const currentIndex = substep ? SUBSTEP_ORDER.indexOf(substep) : -1;
      return currentIndex < SUBSTEP_ORDER.length - 1;
    },
  }));
};
