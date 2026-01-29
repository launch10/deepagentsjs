import { useEffect, useEffectEvent, useRef, useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { type ChatSnapshot, type UseLanggraphOptions, useLanggraph } from "langgraph-ai-sdk-react";
import type { InertiaProps, InsightsBridgeType, InsightsGraphState } from "@shared";
import { useInsightsStore, useStoredInsights, type InsightsStore } from "@stores/insightsStore";

// Use the same types as the Dashboard page
type DashboardProps =
  InertiaProps.paths["/dashboard"]["get"]["responses"]["200"]["content"]["application/json"];
type Insight = NonNullable<DashboardProps["insights"]>[number];

interface InsightsPageProps {
  insights: Insight[] | null;
  metrics_summary: DashboardProps["metrics_summary"];
  thread_id: string;
  jwt?: string;
  langgraph_path?: string;
  [key: string]: unknown;
}

export type InsightsSnapshot = ChatSnapshot<InsightsGraphState>;

/**
 * Get the langgraph options for insights generation.
 */
function useInsightsChatOptions(): UseLanggraphOptions<InsightsBridgeType> {
  const { thread_id, jwt, langgraph_path } = usePage<InsightsPageProps>().props;

  return useMemo(() => {
    const url = langgraph_path ? new URL("api/insights/generate", langgraph_path).toString() : "";

    return {
      api: url,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      getInitialThreadId: () => thread_id,
    };
  }, [thread_id, jwt, langgraph_path]);
}

/**
 * Selector hook for insights state.
 */
export const useInsightsSelector = <TSelected>(
  selector: (snapshot: InsightsSnapshot) => TSelected
) => {
  const options = useInsightsChatOptions();
  return useLanggraph(options, selector);
};

export function useInsightsState() {
  return useInsightsSelector((s) => s.state.insights);
}

export function useInsightsActions() {
  return useInsightsSelector((s) => s.actions);
}

export function useInsightsStatus() {
  return useInsightsSelector((s) => s.status);
}

export function useInsightsError() {
  return useInsightsSelector((s) => s.state.error);
}

/**
 * Hook to initialize insights generation on dashboard load.
 *
 * Pattern: If Rails sent fresh insights, use them. Otherwise, trigger Langgraph.
 * Similar to useStageInit but simpler - just check if serverInsights exist.
 *
 * Uses insightsStore to survive browser back/forward navigation, since Inertia
 * restores pages from history cache with stale pageProps.
 */
export function useInsightsChat() {
  const { insights: serverInsights } = usePage<InsightsPageProps>().props;

  const { updateState } = useInsightsActions();
  const langgraphInsights = useInsightsState();
  const status = useInsightsStatus();
  const error = useInsightsError();

  // Store for surviving back/forward navigation
  const storedInsights = useStoredInsights();
  const setStoredInsights = useInsightsStore((s: InsightsStore) => s.setInsights);

  const isGenerating = useRef(false);

  // Check if we already have fresh insights from Rails
  const hasFreshServerInsights = serverInsights && serverInsights.length > 0;
  const hasStoredInsights = storedInsights && storedInsights.length > 0;

  const maybeGenerateInsights = useEffectEvent(() => {
    // Already generating - don't duplicate
    if (isGenerating.current) return;

    // Rails sent fresh insights - no need to talk to Langgraph
    if (hasFreshServerInsights) return;

    // We have stored insights from this session - no need to regenerate
    if (hasStoredInsights) return;

    isGenerating.current = true;

    // Trigger Langgraph insight generation
    updateState({}).finally(() => {
      isGenerating.current = false;
    });
  });

  useEffect(() => {
    maybeGenerateInsights();
  }, [hasFreshServerInsights, hasStoredInsights]);

  // Store insights when Langgraph generates them
  const hasLanggraphInsights = langgraphInsights && langgraphInsights.length > 0;
  useEffect(() => {
    if (hasLanggraphInsights) {
      setStoredInsights(langgraphInsights);
    }
  }, [hasLanggraphInsights, langgraphInsights, setStoredInsights]);

  const isLoading = status === "streaming" || status === "submitted";

  // Priority: server > stored > langgraph > null
  const insights = hasFreshServerInsights
    ? serverInsights
    : hasStoredInsights
      ? storedInsights
      : hasLanggraphInsights
        ? langgraphInsights
        : null;

  return {
    insights,
    isGenerating: isLoading,
    error: error?.message ?? null,
  };
}
