import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation, type DeployGraphState } from "@annotation";
import { Deploy } from "@types";
import {
  createChatNode,
  taskExecutorNode,
  taskExecutorRouter,
} from "@nodes";

/**
 * Deploy Graph V2 - Task-Based Architecture
 *
 * This dramatically simplified graph replaces the complex conditional routing
 * with a single task executor that loops through tasks in order.
 *
 * Flow:
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ START                                                                    │
 * │   │                                                                      │
 * │   ▼                                                                      │
 * │ createChat (thread ownership validation)                                 │
 * │   │                                                                      │
 * │   ├──[nothing to deploy?]──► END                                         │
 * │   │                                                                      │
 * │   ▼                                                                      │
 * │ taskExecutor ◄────────────────────────────────────────────┐              │
 * │   │                                                       │              │
 * │   ├──[continue]───────────────────────────────────────────┘              │
 * │   │                                                                      │
 * │   ├──[wait]──► END (waiting for webhook)                                 │
 * │   │                                                                      │
 * │   └──[end]──► END (all tasks complete or error)                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The taskExecutor processes tasks in order (defined in TASK_ORDER):
 * 1. ConnectingGoogle (campaign, skippable)
 * 2. VerifyingGoogle (campaign, skippable)
 * 3. AddingAnalytics (all, skippable if no website)
 * 4. OptimizingSEO (all)
 * 5. ValidateLinks (all)
 * 6. RuntimeValidation (all)
 * 7. FixingBugs (only when validation fails)
 * 8. DeployingWebsite (all)
 * 9. DeployingCampaign (campaign)
 * 10. CheckingBilling (campaign, skippable if already verified)
 * 11. EnablingCampaign (campaign)
 *
 * Each task defines:
 * - shouldSkip: Whether to skip this task entirely
 * - isBlocking: Whether to wait for external completion (webhook)
 * - run: The actual task logic
 */

export const deployGraph = new StateGraph(DeployAnnotation)
  // --------------------------------------------------------------------------
  // Security: Create Chat for thread ownership validation
  // --------------------------------------------------------------------------
  .addNode("createChat", createChatNode)

  // --------------------------------------------------------------------------
  // Task Executor: Processes all tasks in order
  // --------------------------------------------------------------------------
  .addNode("taskExecutor", taskExecutorNode)

  // ==========================================================================
  // ROUTING
  // ==========================================================================

  // Start with chat validation
  .addEdge(START, "createChat")

  // After chat validation, either end or start task execution
  .addConditionalEdges("createChat", (state: DeployGraphState) => {
    // Exit early if nothing to deploy
    if (!Deploy.shouldDeployAnything(state)) return END;
    return "taskExecutor";
  })

  // Task executor routing: continue, wait, or end
  .addConditionalEdges("taskExecutor", taskExecutorRouter, {
    continue: "taskExecutor", // Loop back for next task
    wait: END, // Exit, waiting for webhook
    end: END, // All done
  });
