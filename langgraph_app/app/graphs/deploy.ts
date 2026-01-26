import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation, type DeployGraphState } from "@annotation";
import { Deploy } from "@types";
import { initPhasesNode, taskExecutorNode, taskExecutorRouter } from "@nodes";
import { withCreditExhaustion } from "./shared";

/**
 * Deploy Graph V2 - Task-Based Architecture
 *
 * This dramatically simplified graph replaces the complex conditional routing
 * with a single task executor that loops through tasks in order.
 *
 * Credit exhaustion is detected via withCreditExhaustion wrapper,
 * which runs this graph as a subgraph, then calculates credit status.
 *
 * Flow:
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ START                                                                    │
 * │   │                                                                      │
 * │   ├──[nothing to deploy?]──► END                                         │
 * │   │                                                                      │
 * │   ▼                                                                      │
 * │ initPhases                                                               │
 * │   │                                                                      │
 * │   ▼                                                                      │
 * │ taskExecutor ◄────────────────────────────────────────────────────┐      │
 * │   │                                                               │      │
 * │   ├──[continue]───────────────────────────────────────────────────┘      │
 * │   │                                                                      │
 * │   ├──[wait]──► END                                                       │
 * │   │                                                                      │
 * │   └──[end]──► END                                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Chat is pre-created by Rails via ChatCreatable when Deploy record is created.
 * Thread ownership is validated by the route handler before graph execution.
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

export const deployGraph = withCreditExhaustion(
  new StateGraph(DeployAnnotation)
    // --------------------------------------------------------------------------
    // Init Phases: Compute phases from any pre-existing tasks (for tests)
    // --------------------------------------------------------------------------
    .addNode("initPhases", initPhasesNode)

    // --------------------------------------------------------------------------
    // Task Executor: Processes all tasks in order
    // --------------------------------------------------------------------------
    .addNode("taskExecutor", taskExecutorNode)

    // ==========================================================================
    // ROUTING
    // ==========================================================================

    // Chat is pre-created by Rails, route from START
    // Either end early if nothing to deploy, or initialize phases
    .addConditionalEdges(START, (state: DeployGraphState) => {
      // Exit early if nothing to deploy
      if (!Deploy.shouldDeployAnything(state)) return END;
      return "initPhases";
    })

    // After init phases, proceed to task executor
    .addEdge("initPhases", "taskExecutor")

    // Task executor routing: continue, wait, or end
    .addConditionalEdges("taskExecutor", taskExecutorRouter, {
      continue: "taskExecutor", // Loop back for next task
      wait: END, // Exit, waiting for webhook
      end: END, // All done
    }),
  DeployAnnotation
);
