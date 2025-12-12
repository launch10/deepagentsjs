import { createStore } from "zustand";
import { Workflow } from "@shared";

const SUBSTEP_ORDER = Workflow.AdCampaignSteps;

export type WorkflowStepsState = {
  step: Workflow.StepName | null;
  substep: Workflow.AdCampaignStep | null;
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

export const createWorkflowStore = (initialState: Partial<WorkflowStepsState>) =>
  createStore<WorkflowStepsStore>((set, get) => ({
    step: initialState.step ?? null,
    substep: getSubstepFromUrl() ?? initialState.substep ?? "content",
    projectUUID: initialState.projectUUID ?? null,

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
      if (nextSubstep) {
        set({ substep: nextSubstep });
        pushUrl(projectUUID, nextSubstep);
      }
    },

    back: () => {
      const { substep, projectUUID } = get();
      const currentIndex = substep ? SUBSTEP_ORDER.indexOf(substep) : -1;
      const prevSubstep = SUBSTEP_ORDER[currentIndex - 1];
      if (prevSubstep) {
        set({ substep: prevSubstep });
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
