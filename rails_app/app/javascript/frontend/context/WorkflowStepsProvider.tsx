import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";
import { createWorkflowStore, type WorkflowStepsStore } from "@stores/workflowSteps";
import type { Workflow } from "@shared";

type WorkflowStepsStoreApi = StoreApi<WorkflowStepsStore>;

const WorkflowStepsContext = createContext<WorkflowStepsStoreApi | null>(null);

interface WorkflowStepsProviderProps {
  children: ReactNode;
  workflow: { page?: string | null; substep?: string | null } | null | undefined;
  projectUUID: string | null | undefined;
}

export function WorkflowStepsProvider({
  children,
  workflow,
  projectUUID,
}: WorkflowStepsProviderProps) {
  const [store] = useState(() =>
    createWorkflowStore({
      page: (workflow?.page as Workflow.WorkflowPage) ?? null,
      substep: (workflow?.substep as Workflow.SubstepName) ?? null,
      projectUUID: projectUUID ?? null,
    })
  );

  useEffect(() => {
    const handlePopState = () => {
      store.getState().syncFromUrl();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [store]);

  return <WorkflowStepsContext.Provider value={store}>{children}</WorkflowStepsContext.Provider>;
}

export function useWorkflowSteps<T>(selector: (state: WorkflowStepsStore) => T): T | undefined {
  const store = useContext(WorkflowStepsContext);
  if (!store) {
    return undefined;
  }
  return useStore(store, selector);
}

export const selectSteps = (s: WorkflowStepsStore) => s.steps;
export const selectPages = selectSteps;
export const selectPage = (s: WorkflowStepsStore) => s.page;
export const selectStep = (s: WorkflowStepsStore) => s.step;
export const selectSubstep = (s: WorkflowStepsStore) => s.substep;
export const selectPageNumber = (s: WorkflowStepsStore) => s.pageNumber;
export const selectStepNumber = (s: WorkflowStepsStore) => s.stepNumber;
export const selectSubstepNumber = (s: WorkflowStepsStore) => s.substepNumber;
export const selectSetSubstep = (s: WorkflowStepsStore) => s.setSubstep;
export const selectContinue = (s: WorkflowStepsStore) => s.continue;
export const selectBack = (s: WorkflowStepsStore) => s.back;
export const selectCanGoBack = (s: WorkflowStepsStore) => s.canGoBack;
export const selectCanGoForward = (s: WorkflowStepsStore) => s.canGoForward;

export { type WorkflowStepsStore };
