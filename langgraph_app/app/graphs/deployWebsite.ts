import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation } from "@annotation";
import {
  instrumentationNode,
  deployWebsiteNode,
  runtimeValidationNode,
  fixWithCodingAgentNode,
} from "@nodes";
import { Task } from "@types";

const MAX_RETRY_COUNT = 2;

// Helper to check task status
const getTaskStatus = (state: typeof DeployAnnotation.State, name: Task.TaskName) =>
  Task.findTask(state.tasks, name)?.status;

/**
 * Website Deploy Graph
 *
 * Orchestrates website deployment to Cloudflare.
 *
 * 1) Ensure instrumentation is up to date
 * 2) Validate website
 * 3) If validation fails, fix with coding agent
 * 4) Deploy website
 */
export const deployGraph = new StateGraph(DeployAnnotation)
  .addNode("instrumentation", instrumentationNode)
  .addNode("runtimeValidation", runtimeValidationNode)
  .addNode("fixWithCodingAgent", fixWithCodingAgentNode)
  .addNode("deployWebsite", deployWebsiteNode)

  .addEdge(START, "instrumentation")
  .addEdge("instrumentation", "runtimeValidation")

  // Validation routing: pass → deploy, fail → fix (with retry limit)
  .addConditionalEdges("runtimeValidation", (state) => {
    const status = getTaskStatus(state, "RuntimeValidation");
    if (status === "passed") {
      return "deployWebsite";
    }
    if (state.retryCount >= MAX_RETRY_COUNT) {
      return END;
    }
    return "fixWithCodingAgent";
  })

  // Fix loop back to instrumentation
  .addEdge("fixWithCodingAgent", "instrumentation")

  // Deploy website to END
  .addEdge("deployWebsite", END)