import { StateGraph, END, START, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { DeployAnnotation, type DeployGraphState } from "@annotation";
import {
  instrumentationNode,
  seoOptimizationNode,
  deployWebsiteNode,
  runtimeValidationNode,
  validateLinksNode,
  bugFixNode,
  createEnqueueNode,
} from "@nodes";
import { Task } from "@types";

const MAX_RETRY_COUNT = 2;

/**
 * Website Deploy Graph
 *
 * Orchestrates website deployment to Cloudflare.
 *
 * 1) Ensure instrumentation is up to date
 * 2) Optimize SEO meta tags
 * 3) Validate links (static analysis)
 * 4) Validate website (runtime with Playwright)
 * 5) If validation fails, fix with coding agent
 * 6) Deploy website
 */
export const deployWebsiteGraph = new StateGraph(DeployAnnotation)
  // Enqueue nodes (lightweight, checkpoint state before work)
  .addNode("enqueueInstrumentation", createEnqueueNode("AddingAnalytics"))
  .addNode("enqueueSEOOptimization", createEnqueueNode("OptimizingSEO"))
  .addNode("enqueueValidateLinks", createEnqueueNode("ValidateLinks"))
  .addNode("enqueueRuntimeValidation", createEnqueueNode("RuntimeValidation"))
  .addNode("enqueueBugFix", createEnqueueNode("FixingBugs"))
  .addNode("enqueueDeploy", createEnqueueNode("DeployingWebsite"))

  // Work nodes
  .addNode("instrumentation", instrumentationNode)
  .addNode("seoOptimization", seoOptimizationNode)
  .addNode("validateLinks", validateLinksNode)
  .addNode("runtimeValidation", runtimeValidationNode)
  .addNode("bugFixNode", bugFixNode)
  .addNode("deployWebsite", deployWebsiteNode)

  // START → enqueue → work
  .addConditionalEdges(START, (state) => {
    const websiteDeployTask = Task.findTask(state.tasks, "DeployingWebsite");
    // If we've created the website deploy task AT ALL, that means we're already in progress or finished
    if (websiteDeployTask) {
      return END;
    }
    return "enqueueInstrumentation";
  })
  .addEdge("enqueueInstrumentation", "instrumentation")
  .addEdge("instrumentation", "enqueueSEOOptimization")
  .addEdge("enqueueSEOOptimization", "seoOptimization")
  .addEdge("seoOptimization", "enqueueValidateLinks")
  .addEdge("enqueueValidateLinks", "validateLinks")

  // Link validation routing: pass → runtime validation, fail → fix
  .addConditionalEdges("validateLinks", (state) => {
    const task = Task.findTask(state.tasks, "ValidateLinks");
    if (task?.status === "completed") {
      return "enqueueRuntimeValidation";
    }
    return "enqueueBugFix";
  })

  .addEdge("enqueueRuntimeValidation", "runtimeValidation")

  // Runtime validation routing: pass → deploy, fail → fix (with retry limit)
  .addConditionalEdges("runtimeValidation", (state) => {
    const task = Task.findTask(state.tasks, "RuntimeValidation");
    const status = task?.status;
    if (status === "completed") {
      return "enqueueDeploy";
    }
    const retryCount = task?.retryCount || 0;
    if (retryCount >= MAX_RETRY_COUNT) {
      return END;
    }
    return "enqueueBugFix";
  })

  // Fix loop back to validateLinks (re-validate after fix)
  .addEdge("enqueueBugFix", "bugFixNode")
  .addEdge("bugFixNode", "validateLinks")

  // Deploy
  .addEdge("enqueueDeploy", "deployWebsite")
  .addEdge("deployWebsite", END);
