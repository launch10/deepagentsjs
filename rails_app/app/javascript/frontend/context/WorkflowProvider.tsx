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

/**
 * Check if history.state contains a valid Inertia page object for the current URL.
 *
 * Important: We must check that the Inertia state URL matches the current URL.
 * When Inertia navigates away from a pushState URL, it saves its current page state
 * to history.state (via replaceState). This overwrites our pushState state, but
 * the saved state has the WRONG URL (the original Inertia URL, not our pushState URL).
 *
 * For example:
 * 1. User at /projects/new (Inertia state with url="/projects/new")
 * 2. Chat creates thread, pushState to /projects/{uuid}/brainstorm (state = { threadId })
 * 3. User clicks "+" button, Inertia replaces state before navigating
 *    - history.state now has Inertia state with url="/projects/new" (wrong!)
 * 4. User presses back to /projects/{uuid}/brainstorm
 *    - URL is /projects/{uuid}/brainstorm
 *    - But history.state.url is "/projects/new"
 *
 * We detect this mismatch and trigger a reload.
 */
function hasValidInertiaPageState(): boolean {
  const state = window.history.state;
  // Inertia page objects have these properties, and the URL should match
  return (
    state &&
    typeof state === "object" &&
    "component" in state &&
    "props" in state &&
    "url" in state &&
    state.url === window.location.pathname + window.location.search
  );
}

/**
 * Check if the current URL is a project brainstorm page that needs data.
 */
function isProjectBrainstormUrl(): boolean {
  const path = window.location.pathname;
  return /^\/projects\/[^/]+\/brainstorm$/.test(path) && !path.includes("/projects/new");
}

export function WorkflowProvider({ children }: WorkflowProviderProps) {
  const [store] = useState(() => createWorkflowStore());

  // Sync from URL on any URL change (popstate, pushState, replaceState)
  useEffect(() => {
    const syncFromUrl = () => store.getState().syncFromUrl();

    // Handle popstate (back/forward) - may need to reload if Inertia doesn't have state
    const handlePopstate = () => {
      syncFromUrl();

      // If we navigated to a project brainstorm URL but Inertia doesn't have valid page state
      // for this URL, we need to fetch the page data from the server.
      //
      // This handles several scenarios:
      // 1. Pure browser back/forward after pushState (no Inertia state at all)
      // 2. Back after Inertia navigation (Inertia state exists but for wrong URL)
      //
      // We use router.visit instead of router.reload because the current Inertia page state
      // may be for a different URL entirely. router.reload preserves the current page component,
      // but we need to fetch and render the correct page.
      if (isProjectBrainstormUrl() && !hasValidInertiaPageState()) {
        // Navigate to this URL via Inertia to fetch fresh data and render correct page
        router.visit(window.location.href, { preserveScroll: true });
      }
    };

    // Browser back/forward
    window.addEventListener("popstate", handlePopstate);
    // pushState/replaceState (from chat hooks, workflow navigation, etc.)
    window.addEventListener(URL_CHANGE_EVENT, syncFromUrl);

    return () => {
      window.removeEventListener("popstate", handlePopstate);
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
