import { Insights, type PrimaryKeyType } from "../types";
import { type CoreGraphState } from "../types/graph";
import type { Simplify } from "type-fest";
import { type BridgeType } from "langgraph-ai-sdk-types";

export type InsightsGraphState = Simplify<
  CoreGraphState & {
    metrics: Insights.Metrics | undefined;
    insights: Insights.Insight[];
    dashboardInsightId: PrimaryKeyType | undefined;
    skipGeneration: boolean;
  }
>;

export type InsightsBridgeType = BridgeType<InsightsGraphState, typeof Insights.jsonSchema>;
