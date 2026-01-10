import { StateGraph, END, START, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { DeployAnnotation, type DeployGraphState } from "@annotation";
import {
  instrumentationNode,
  deployWebsiteNode,
  runtimeValidationNode,
  fixWithCodingAgentNode,
  createEnqueueNode,
} from "@nodes";
import { Task } from "@types";

const MAX_RETRY_COUNT = 2;

// Helper to check task status
const getTaskStatus = (state: DeployGraphState, name: Task.TaskName) =>
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
export const deployWebsiteGraph = new StateGraph(DeployAnnotation)
  // Enqueue nodes (lightweight, checkpoint state before work)
  .addNode("enqueueInstrumentation", createEnqueueNode("Instrumentation"))
  .addNode("enqueueValidation", createEnqueueNode("RuntimeValidation"))
  .addNode("enqueueBugFix", createEnqueueNode("BugFix"))
  .addNode("enqueueDeploy", createEnqueueNode("WebsiteDeploy"))

  // Work nodes
  .addNode("instrumentation", instrumentationNode)
  .addNode("runtimeValidation", runtimeValidationNode)
  .addNode("fixWithCodingAgent", fixWithCodingAgentNode)
  .addNode("deployWebsite", deployWebsiteNode)

  // START → enqueue → work
  .addConditionalEdges(START, (state) => {
    const websiteDeployTask = Task.findTask(state.tasks, "WebsiteDeploy");
    // If we've created the website deploy task AT ALL, that means we're already in progress or finished
    if (websiteDeployTask) {
      return END;
    }
    return "enqueueInstrumentation";
  })
  .addEdge("enqueueInstrumentation", "instrumentation")
  .addEdge("instrumentation", "enqueueValidation")
  .addEdge("enqueueValidation", "runtimeValidation")

  // Validation routing: pass → deploy, fail → fix (with retry limit)
  .addConditionalEdges("runtimeValidation", (state) => {
    const status = getTaskStatus(state, "RuntimeValidation");
    if (status === "passed") {
      return "enqueueDeploy";
    }
    const retryCount = Task.findTask(state.tasks, "RuntimeValidation")?.retryCount || 0;
    if (retryCount >= MAX_RETRY_COUNT) {
      return END;
    }
    return "enqueueBugFix";
  })

  // Fix loop back to instrumentation (re-enqueue for retry)
  .addEdge("enqueueBugFix", "fixWithCodingAgent")
  .addEdge("fixWithCodingAgent", "enqueueInstrumentation")

  // Deploy
  .addEdge("enqueueDeploy", "deployWebsite")
  .addEdge("deployWebsite", END)