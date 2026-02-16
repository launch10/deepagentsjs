import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation, type DeployGraphState } from "@annotation";
import { Deploy } from "@types";
import {
  createDeployNode,
  initPhasesNode,
  taskExecutorNode,
  taskExecutorRouter,
  validateDeployNode,
} from "@nodes";
import { withCreditExhaustion } from "./shared";
import { getLogger } from "@core";

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
 * │ validateDeploy (check preconditions: domain assigned, etc.)              │
 * │   │                                                                      │
 * │   ├──[validation failed?]──► END (with error)                            │
 * │   │                                                                      │
 * │   ▼                                                                      │
 * │ createDeploy (idempotent chat creation via Rails API)                    │
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
 * Chat is created by createDeploy node via Rails API.
 * Frontend triggers the graph with a fresh thread_id; the node idempotently
 * creates the Chat record. Thread ownership is validated by JWT auth.
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
    // Validate Deploy: Check preconditions (domain assigned, etc.)
    // --------------------------------------------------------------------------
    .addNode("validateDeploy", validateDeployNode)

    // --------------------------------------------------------------------------
    // Init Deploy: Idempotent chat creation via Rails API
    // --------------------------------------------------------------------------
    .addNode("createDeploy", createDeployNode)

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

    // Route from START: exit early if nothing to deploy, or validate first
    .addConditionalEdges(START, (state: DeployGraphState) => {
      const log = getLogger({ component: "deployGraph" });
      log.info(
        {
          deployId: state.deployId,
          instructions: state.instructions,
          taskCount: state.tasks?.length ?? 0,
          status: state.status,
        },
        "Deploy graph entry — evaluating whether to deploy"
      );

      if (!Deploy.shouldDeployAnything(state)) {
        log.info({ instructions: state.instructions }, "Nothing to deploy, exiting early");
        return END;
      }

      log.info("Proceeding to validateDeploy");
      return "validateDeploy";
    })

    // After validation: exit on failure, continue to createDeploy on success
    .addConditionalEdges("validateDeploy", (state: DeployGraphState) => {
      if (state.status === "failed") {
        return END;
      }
      return "createDeploy";
    })

    // After init deploy, initialize phases
    .addEdge("createDeploy", "initPhases")

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
