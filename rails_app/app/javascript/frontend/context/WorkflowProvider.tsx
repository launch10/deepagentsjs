/**
 * Minimal Workflow Provider
 *
 * URL is the single source of truth. This provider just:
 * 1. Creates the store (which initializes from URL)
 * 2. Handles all URL changes (popstate, pushState, Inertia navigation)
 * 3. Syncs substep to chat registry (so chat knows current stage)
 *
 * No sync from Inertia props.
 * Components read from store, actions change URL.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";
import { router } from "@inertiajs/react";
import { createWorkflowStore, type WorkflowStore } from "@stores/workflowStore";
import { chatsRegistryStore } from "@stores/chatsRegistry";

type WorkflowStoreApi = StoreApi<WorkflowStore>;

const WorkflowContext = createContext<WorkflowStoreApi | null>(null);

// Custom event name for pushState/replaceState URL changes
const URL_CHANGE_EVENT = "urlchange";

// Patch history methods to dispatch events (only once globally)
let historyPatched = false;
function patchHistoryMethods() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args) {
    const result = originalPushState(...args);
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplaceState(...args);
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
    return result;
  };
}

// Patch on module load
patchHistoryMethods();

interface WorkflowProviderProps {
  children: ReactNode;
}

export function WorkflowProvider({ children }: WorkflowProviderProps) {
  const [store] = useState(() => createWorkflowStore());

  // Sync from URL on any URL change (popstate, pushState, replaceState)
  useEffect(() => {
    const syncFromUrl = () => store.getState().syncFromUrl();

    // Browser back/forward
    window.addEventListener("popstate", syncFromUrl);
    // pushState/replaceState (from chat hooks, workflow navigation, etc.)
    window.addEventListener(URL_CHANGE_EVENT, syncFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener(URL_CHANGE_EVENT, syncFromUrl);
    };
  }, [store]);

  // Sync from URL on Inertia navigation (full page component swap)
  // This handles cross-page navigation that replaces React components
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
