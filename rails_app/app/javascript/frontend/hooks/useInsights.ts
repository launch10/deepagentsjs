import { useEffect, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import type { InertiaProps } from "@shared";

// Use the same types as the Dashboard page
type DashboardProps =
  InertiaProps.paths["/dashboard"]["get"]["responses"]["200"]["content"]["application/json"];
type Insight = NonNullable<DashboardProps["insights"]>[number];

interface InsightsPageProps {
  insights: Insight[] | null;
  metrics_summary: DashboardProps["metrics_summary"];
  jwt?: string;
  langgraph_path?: string;
  [key: string]: unknown;
}

interface UseInsightsResult {
  insights: Insight[] | null;
  isGenerating: boolean;
  error: string | null;
}

/**
 * Hook to initialize insights generation on dashboard load.
 *
 * Similar to useStageInit - runs once on mount to trigger Langgraph
 * insight generation when metrics_summary is present (indicating
 * insights need to be generated).
 *
 * @returns Current insights state, loading status, and any errors
 */
export function useInsights(): UseInsightsResult {
  const {
    insights: serverInsights,
    metrics_summary,
    jwt,
    langgraph_path,
  } = usePage<InsightsPageProps>().props;

  // Local state for generated insights (overrides server insights once available)
  const [generatedInsights, setGeneratedInsights] = useState<Insight[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasStartedGeneration = useRef(false);

  useEffect(() => {
    // Already have insights from server - no need to generate
    if (serverInsights && serverInsights.length > 0) {
      return;
    }

    // No metrics_summary means nothing to generate from
    if (!metrics_summary) {
      return;
    }

    // Already started generation - don't duplicate
    if (hasStartedGeneration.current) {
      return;
    }

    // Missing required config
    if (!jwt || !langgraph_path) {
      return;
    }

    hasStartedGeneration.current = true;
    setIsGenerating(true);
    setError(null);

    const generateInsights = async () => {
      try {
        const url = new URL("api/insights/generate", langgraph_path).toString();
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setGeneratedInsights(data.insights || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate insights";
        console.error("Error generating insights:", message);
        setError(message);
      } finally {
        setIsGenerating(false);
      }
    };

    generateInsights();
  }, [serverInsights, metrics_summary, jwt, langgraph_path]);

  // Return generated insights if available, otherwise server insights
  return {
    insights: generatedInsights ?? serverInsights,
    isGenerating,
    error,
  };
}
