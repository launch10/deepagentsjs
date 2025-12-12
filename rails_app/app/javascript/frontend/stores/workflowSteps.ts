import { createStore } from "zustand";
import { Workflow } from "@shared";

const SUBSTEP_ORDER = Workflow.AdCampaignSteps;

export type WorkflowStepsState = {
  steps: Readonly<Workflow.WorkflowStep[]>; // hardcode for now
  step: Workflow.WorkflowStep; // these all need to be thought out for future workflows
  substep: Workflow.AdCampaignStep | null;
  stepNumber: number;
  substepNumber: number | null;
  projectUUID: string | null;
};

export type WorkflowStepsActions = {
  setSubstep: (substep: Workflow.AdCampaignStep) => void;
  syncFromUrl: () => void;
  continue: () => void;
  back: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
};

export type WorkflowStepsStore = WorkflowStepsState & WorkflowStepsActions;

function getSubstepFromUrl(): Workflow.AdCampaignStep | null {
  const path = window.location.pathname;
  const match = path.match(/\/campaigns\/(\w+)$/);
  const substep = match?.[1];
  return substep && SUBSTEP_ORDER.includes(substep as Workflow.AdCampaignStep)
    ? (substep as Workflow.AdCampaignStep)
    : null;
}

function pushUrl(projectUUID: string | null, substep: Workflow.AdCampaignStep) {
  if (projectUUID) {
    window.history.pushState({}, "", `/projects/${projectUUID}/campaigns/${substep}`);
  }
}

const findStepIndex = (step: Workflow.WorkflowStep): number => {
  return Workflow.WorkflowSteps.findIndex((s) => s == step);
};

const findSubstepIndex = (substep: Workflow.AdCampaignStep | null): number | null => {
  if (!substep) return null;
  return Workflow.AdCampaignSteps.findIndex((s) => s == substep) || null;
};

export const createWorkflowStore = (
  initialState: Pick<WorkflowStepsState, "step" | "substep" | "projectUUID">
) => {
  const step = initialState.step;
  const substep = initialState.substep ?? null;
  const stepNumber = findStepIndex(step);
  const substepNumber = findSubstepIndex(substep);

  return createStore<WorkflowStepsStore>((set, get) => ({
    name: "launch",
    steps: Workflow.WorkflowSteps,
    step: step,
    substep: substep,
    projectUUID: initialState.projectUUID ?? null,
    stepNumber: stepNumber,
    substepNumber: substepNumber,

    setSubstep: (substep) => {
      set({ substep });
      pushUrl(get().projectUUID, substep);
    },

    syncFromUrl: () => {
      const substep = getSubstepFromUrl();
      if (substep) {
        set({ substep });
      }
    },

    continue: () => {
      const { substep, projectUUID } = get();
      const currentIndex = substep ? SUBSTEP_ORDER.indexOf(substep) : -1;
      const nextSubstep = SUBSTEP_ORDER[currentIndex + 1];
      const substepNumber = findSubstepIndex(nextSubstep);
      if (nextSubstep) {
        set({ substep: nextSubstep, substepNumber: substepNumber });
        pushUrl(projectUUID, nextSubstep);
      }
    },

    back: () => {
      const { substep, projectUUID } = get();
      const currentIndex = substep ? SUBSTEP_ORDER.indexOf(substep) : -1;
      const prevSubstep = SUBSTEP_ORDER[currentIndex - 1];
      const substepNumber = findSubstepIndex(prevSubstep);
      if (prevSubstep) {
        set({ substep: prevSubstep, substepNumber: substepNumber });
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
