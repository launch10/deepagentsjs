import z from "zod";
import { type BridgeType } from "langgraph-ai-sdk-types";
import type { CoreGraphState } from "../graph";
import type { Simplify } from "type-fest";

// Minimal JSON schema for deploy - we don't stream structured content like Ads
export const jsonSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
});

// Simple merge reducer - deploy state is mostly replaced, not merged
export const MergeReducer = {
  phases: (incoming: unknown[], current: unknown[] | undefined) => incoming,
  tasks: (incoming: unknown[], current: unknown[] | undefined) => {
    // Merge tasks by name (same logic as annotation reducer)
    const taskMap = new Map((current || []).map((t: any) => [t.name, t]));
    for (const task of incoming as any[]) {
      taskMap.set(task.name, { ...taskMap.get(task.name), ...task });
    }
    return Array.from(taskMap.values());
  },
  status: (incoming: string, _current: string | undefined) => incoming,
  result: (incoming: unknown, _current: unknown) => incoming,
};

// Deploy graph state
export type DeployGraphState = Simplify<
  CoreGraphState & {
    status?: "pending" | "running" | "completed" | "failed";
    phases?: Array<{
      name: string;
      label: string;
      status: "pending" | "running" | "completed" | "failed";
      statusLabel?: string;
    }>;
    tasks?: Array<{
      name: string;
      status: "pending" | "enqueued" | "running" | "completed" | "failed";
      jobId?: number;
      result?: Record<string, unknown>;
      error?: string;
    }>;
    result?: Record<string, unknown>;
    consoleErrors?: Array<{ message: string; timestamp: string }>;
    // For polling
    polling?: boolean;
    // For starting deploy
    deploy?: {
      deployId: number;
      websiteId?: number;
      campaignId?: number;
      website: boolean;
      googleAds: boolean;
    };
  }
>;

// Export the bridge type for use in useDeployChat
export type DeployBridgeType = BridgeType<DeployGraphState, typeof jsonSchema>;
