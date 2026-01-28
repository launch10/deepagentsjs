import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";
import type { Insights } from "@types";

/**
 * Type definitions for dashboard insights operations
 * Note: These may need to be updated once the OpenAPI spec is regenerated
 */
export interface DashboardInsightRecord {
  id: number | null;
  insights: Insights.Insight[] | null;
  generated_at: string | null;
  fresh: boolean;
  metrics_summary: Insights.MetricsInput | null;
}

export interface CreateDashboardInsightParams {
  insights: Insights.Insight[];
  metrics_summary?: Insights.MetricsInput;
}

/**
 * Service for interacting with the Rails Dashboard Insights API
 * Used by Langgraph to fetch metrics and save generated insights
 */
export class DashboardInsightsAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  /**
   * Retrieves the current dashboard insights for the account
   * Includes freshness information to determine if regeneration is needed
   *
   * @returns The current insight record (or empty state if none exists)
   */
  async get(): Promise<DashboardInsightRecord> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/dashboard_insights" as any, {});

    if (response.error) {
      throw new Error(`Failed to get dashboard insights: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to get dashboard insights: No data returned`);
    }

    return response.data as DashboardInsightRecord;
  }

  /**
   * Creates or updates dashboard insights for the account
   *
   * @param insights - Array of exactly 3 insights to save
   * @param metrics_summary - Optional metrics used for generation (for auditing)
   * @returns The saved insight record
   */
  async save({ insights, metrics_summary }: CreateDashboardInsightParams): Promise<DashboardInsightRecord> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/dashboard_insights" as any, {
      body: {
        dashboard_insight: {
          insights,
          ...(metrics_summary ? { metrics_summary } : {}),
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to save dashboard insights: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to save dashboard insights: No data returned`);
    }

    return response.data as DashboardInsightRecord;
  }

  /**
   * Retrieves the metrics summary for insight generation
   * This is the input data that gets passed to the LLM for generating insights
   *
   * @returns The metrics summary from InsightsMetricsService
   */
  async getMetricsSummary(): Promise<Insights.MetricsInput> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/dashboard_insights/metrics_summary" as any, {});

    if (response.error) {
      throw new Error(`Failed to get metrics summary: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to get metrics summary: No data returned`);
    }

    return response.data as Insights.MetricsInput;
  }
}
