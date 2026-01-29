/**
 * Insights Store
 *
 * Caches generated insights to survive browser back/forward navigation.
 * When Inertia restores a page from history cache, pageProps have stale data.
 * This store preserves insights generated during the session.
 *
 * No persistence - fresh page load should fetch fresh insights.
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { InertiaProps } from "@shared";

type DashboardProps =
  InertiaProps.paths["/dashboard"]["get"]["responses"]["200"]["content"]["application/json"];
type Insight = NonNullable<DashboardProps["insights"]>[number];

interface InsightsState {
  insights: Insight[] | null;
  generatedAt: number | null;
}

interface InsightsActions {
  setInsights: (insights: Insight[]) => void;
  clear: () => void;
}

export type InsightsStore = InsightsState & InsightsActions;

const initialState: InsightsState = {
  insights: null,
  generatedAt: null,
};

export const useInsightsStore = create<InsightsStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    setInsights: (insights) => {
      set({
        insights,
        generatedAt: Date.now(),
      });
    },

    clear: () => set(initialState),
  }))
);

// Selectors
export const selectInsights = (s: InsightsStore) => s.insights;
export const selectHasGeneratedInsights = (s: InsightsStore) =>
  s.insights !== null && s.insights.length > 0;

// Convenience hooks
export function useStoredInsights() {
  return useInsightsStore(selectInsights);
}

export function useHasGeneratedInsights() {
  return useInsightsStore(selectHasGeneratedInsights);
}
