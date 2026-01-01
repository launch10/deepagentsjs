import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";
import { usePage } from "@inertiajs/react";
import { createWorkflowStore, type WorkflowStepsStore } from "@stores/workflowSteps";
import { chatsRegistryStore } from "@stores/chatsRegistry";
import type { Workflow } from "@shared";

// URLs that should clear the workflow state
const CLEAR_WORKFLOW_URLS = ["/", "/projects/new"];

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
  const { url } = usePage();
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

  // Clear workflow state when navigating to "clear" URLs (home, /projects/new)
  // This effect responds to Inertia URL changes
  useEffect(() => {
    if (CLEAR_WORKFLOW_URLS.includes(url)) {
      const currentState = store.getState();
      if (currentState.page || currentState.substep || currentState.projectUUID) {
        store.getState().clear();
      }
    }
  }, [store, url]);

  // Sync store when Inertia props change (e.g., navigating to a different project or page)
  // This handles cases where the layout doesn't remount but the page props change
  useEffect(() => {
    const page = (workflow?.page as Workflow.WorkflowPage) ?? null;
    const substep = (workflow?.substep as Workflow.SubstepName) ?? null;
    const uuid = projectUUID ?? null;
    const currentState = store.getState();

    // Skip if navigating to a "clear" URL (handled by the other effect)
    if (CLEAR_WORKFLOW_URLS.includes(url)) {
      return;
    }

    // Update store if projectUUID or page changed
    const projectChanged = uuid !== currentState.projectUUID;
    const pageChanged = page !== currentState.page;

    if (projectChanged || pageChanged) {
      if (page) {
        store.getState().setPage(page, uuid ?? undefined, false);
      }
      if (substep) {
        store.getState().setSubstep(substep);
      }
    }
  }, [store, workflow?.page, workflow?.substep, projectUUID, url]);

  // Whenever workflow state changes, sync it to the current chat
  // so that the chat can know what page we're looking at
  // If we don't do this, and user sends a message, the chat won't
  // receive updated substep information
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state) => ({ substep: state.substep, page: state.page }),
      ({ substep, page }) => {
        if (page && substep) {
          chatsRegistryStore.getState().syncStageToChat(page, substep);
        }
      },
      { fireImmediately: true }
    );
    return unsubscribe;
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
export const selectSetPage = (s: WorkflowStepsStore) => s.setPage;
export const selectClear = (s: WorkflowStepsStore) => s.clear;
export const selectContinue = (s: WorkflowStepsStore) => s.continue;
export const selectBack = (s: WorkflowStepsStore) => s.back;
export const selectCanGoBack = (s: WorkflowStepsStore) => s.canGoBack;
export const selectCanGoForward = (s: WorkflowStepsStore) => s.canGoForward;
export const selectHasVisitedReview = (s: WorkflowStepsStore) => s.hasVisitedReview;
export const selectReturnToReview = (s: WorkflowStepsStore) => s.returnToReview;
export const selectReturnToSection = (s: WorkflowStepsStore) => s.returnToSection;
export const selectClearReturnToSection = (s: WorkflowStepsStore) => s.clearReturnToSection;

export { type WorkflowStepsStore };
