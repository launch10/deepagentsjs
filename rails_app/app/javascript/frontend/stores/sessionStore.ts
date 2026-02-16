/**
 * Session Store
 *
 * Single source of truth for session-level data that persists across navigation.
 * Unlike projectStore (which resets per-page), this data is app-global.
 *
 * Contains:
 * - User identity (currentUser, trueUser, impersonating)
 * - API config (jwt, langgraphPath, rootPath)
 *
 * Hydrated in SiteLayout from page props. Components read from this store,
 * never directly from usePage().props for session data.
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  admin?: boolean;
}

export interface SessionState {
  // User identity
  currentUser: SessionUser | null;
  trueUser: SessionUser | null;
  impersonating: boolean;

  // API config
  jwt: string | null;
  langgraphPath: string | null;
  rootPath: string | null;
}

export interface SessionActions {
  /** Update session state - merges with existing */
  set: (updates: Partial<SessionState>) => void;

  /** Hydrate from page props - call once in layout */
  hydrateFromPageProps: (props: {
    current_user?: SessionUser | null;
    true_user?: SessionUser | null;
    impersonating?: boolean;
    jwt?: string | null;
    langgraph_path?: string | null;
    root_path?: string | null;
  }) => void;
}

export type SessionStore = SessionState & SessionActions;

const initialState: SessionState = {
  currentUser: null,
  trueUser: null,
  impersonating: false,
  jwt: null,
  langgraphPath: null,
  rootPath: null,
};

export const useSessionStore = create<SessionStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    set: (updates) => set((state) => ({ ...state, ...updates })),

    hydrateFromPageProps: (props) => {
      set((state) => ({
        currentUser: props.current_user !== undefined ? props.current_user ?? null : state.currentUser,
        trueUser: props.true_user !== undefined ? props.true_user ?? null : state.trueUser,
        impersonating: props.impersonating !== undefined ? props.impersonating ?? false : state.impersonating,
        jwt: props.jwt !== undefined ? props.jwt ?? null : state.jwt,
        langgraphPath: props.langgraph_path !== undefined ? props.langgraph_path ?? null : state.langgraphPath,
        rootPath: props.root_path !== undefined ? props.root_path ?? null : state.rootPath,
      }));
    },
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectCurrentUser = (s: SessionStore) => s.currentUser;
export const selectTrueUser = (s: SessionStore) => s.trueUser;
export const selectImpersonating = (s: SessionStore) => s.impersonating;
export const selectJwt = (s: SessionStore) => s.jwt;
export const selectLanggraphPath = (s: SessionStore) => s.langgraphPath;
export const selectRootPath = (s: SessionStore) => s.rootPath;

// ============================================================================
// Convenience hooks
// ============================================================================

export function useCurrentUser() {
  return useSessionStore(selectCurrentUser);
}

export function useTrueUser() {
  return useSessionStore(selectTrueUser);
}

export function useImpersonating() {
  return useSessionStore(selectImpersonating);
}

export function useJwt() {
  return useSessionStore(selectJwt);
}

export function useLanggraphPath() {
  return useSessionStore(selectLanggraphPath);
}

export function useRootPath() {
  return useSessionStore(selectRootPath);
}
