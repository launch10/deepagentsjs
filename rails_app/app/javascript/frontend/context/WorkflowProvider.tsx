/**
 * Minimal Workflow Provider
 *
 * URL is the single source of truth. This provider just:
 * 1. Creates the store (which initializes from URL)
 * 2. Handles URL changes (popstate, Inertia navigation)
 * 3. Syncs substep to chat registry (so chat knows current stage)
 *
 * Note: We use Inertia's router.push() for client-side navigation (useBrainstormChat),
 * which properly registers with Inertia's history tracking. This eliminates the need
 * for custom history patching or URL detection hacks.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";
import { router } from "@inertiajs/react";
import { createWorkflowStore, type WorkflowStore } from "@stores/workflowStore";
import { chatsRegistryStore } from "@stores/chatsRegistry";

type WorkflowStoreApi = StoreApi<WorkflowStore>;

const WorkflowContext = createContext<WorkflowStoreApi | null>(null);

interface WorkflowProviderProps {
  children: ReactNode;
}

export function WorkflowProvider({ children }: WorkflowProviderProps) {
  const [store] = useState(() => createWorkflowStore());

  // Sync from URL on browser back/forward
  useEffect(() => {
    const handlePopstate = () => {
      store.getState().syncFromUrl();
    };

    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, [store]);

  // Sync on Inertia navigation (including router.push)
  useEffect(() => {
    return router.on("navigate", () => {
      store.getState().syncFromUrl();
    });
  }, [store]);

  // Sync substep to chat registry so chats know current stage
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

  return <WorkflowContext.Provider value={store}>{children}</WorkflowContext.Provider>;
}

/**
 * Hook to access workflow store with a selector
 */
export function useWorkflow<T>(selector: (state: WorkflowStore) => T): T {
  const store = useContext(WorkflowContext);
  if (!store) {
    throw new Error("useWorkflow must be used within WorkflowProvider");
  }
  return useStore(store, selector);
}

/**
 * Hook to access workflow store with optional selector (returns undefined if no provider)
 * Use this in components that might be rendered outside the provider
 */
export function useWorkflowOptional<T>(selector: (state: WorkflowStore) => T): T | undefined {
  const store = useContext(WorkflowContext);
  if (!store) {
    return undefined;
  }
  return useStore(store, selector);
}

// Re-export selectors for convenience
export {
  selectCanGoBack,
  selectCanGoForward,
  selectPageNumber,
  selectPage,
  selectSubstep,
  selectProjectUUID,
  selectNavigate,
  selectContinue,
  selectBack,
  selectPages,
  selectStep,
  selectHasVisitedReview,
  selectReturnToSection,
  selectReturnToReview,
  selectSetReturnToSection,
  selectClearReturnToSection,
  selectSetSubstep,
  WORKFLOW_STEPS,
} from "@stores/workflowStore";

export type { WorkflowStore };
