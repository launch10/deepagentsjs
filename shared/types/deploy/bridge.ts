import z from "zod";
import { type BridgeType } from "langgraph-ai-sdk-types";
import type { CoreGraphState } from "../graph";
import type { Simplify } from "type-fest";
import type { PrimaryKeyType } from "../core";
import type { ConsoleError } from "../website/errors";
import type { Instructions } from "./types";
import type { Phase } from "./phase";
import type { Task } from "../../types/task";
import type { Status } from "../core";

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

// Deploy graph state — must match DeployAnnotation.State in langgraph_app
export type DeployGraphState = Simplify<
  CoreGraphState & {
    // Rails Deploy record ID
    deployId: PrimaryKeyType | undefined;
    // Deploy status
    status: Status | undefined;
    // Deploy result from the job
    result: Record<string, unknown> | undefined;
    // Boolean flags for what to deploy (website, googleAds)
    instructions: Instructions;
    // IDs (websiteId already in CoreGraphState)
    campaignId: PrimaryKeyType | undefined;
    // Console errors from runtime validation
    consoleErrors: ConsoleError[];
    // Support ticket reference (e.g. "SR-XXXXXXXX") — set on unrecoverable failure
    supportTicket: string | undefined;
    // Task tracking
    tasks: Task[];
    // Signal from frontend that this is a polling request
    polling: boolean;
    // Nothing changed — deploy skipped because no content changed since last deploy
    nothingChanged: boolean;
    // Phases computed from tasks for frontend display
    phases: Phase[];
  }
>;

// Export the bridge type for use in useDeployChat
export type DeployBridgeType = BridgeType<DeployGraphState, typeof jsonSchema>;
