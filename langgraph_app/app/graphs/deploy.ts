import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation } from "@annotation";
import {
  instrumentationNode,
  deployWebsiteNode,
  runtimeValidationNode,
  fixWithCodingAgentNode,
} from "@nodes";
import { deployCampaignNode } from "../nodes/deploy/deployCampaignNode";

// Helper to check task status
const getTaskStatus = (state: typeof DeployAnnotation.State, name: string) =>
  state.tasks.find((t) => t.name === name)?.status;

/**
 * Deploy Graph (Unified)
 *
 * Orchestrates ALL deployment: website deployment to Cloudflare AND Google Ads campaign deployment.
 * Uses boolean flags to control which deployments to execute.
 *
 * Flow:
 * START
 *   ↓
 *   ├── (if !deployWebsite && !deployGoogleAds) → END (no-op)
 *   ↓
 * instrumentationNode (if deployWebsite)
 *   ↓
 * runtimeValidationNode (if deployWebsite) - validates BEFORE deploy
 *   ↓  (if errors && retryCount < 2)
 *   └──→ fixWithCodingAgentNode → instrumentationNode
 *   ↓  (if pass || retryCount >= 2)
 * deployWebsiteNode (if deployWebsite)
 *   ↓
 * deployCampaignNode (if deployGoogleAds)
 *   ↓
 * END
 */
export const deployGraph = new StateGraph(DeployAnnotation)
  .addNode("instrumentation", instrumentationNode)
  .addNode("runtimeValidation", runtimeValidationNode)
  .addNode("fixWithCodingAgent", fixWithCodingAgentNode)
  .addNode("deployWebsite", deployWebsiteNode)
  .addNode("deployCampaign", deployCampaignNode)

  // Start: check flags, exit early if nothing to deploy
  .addConditionalEdges(START, (state) => {
    if (!state.deployWebsite && !state.deployGoogleAds) return END; // No-op
    if (state.deployWebsite) return "instrumentation";
    return "deployCampaign";
  })

  // Website deploy flow: instrumentation → validation
  .addEdge("instrumentation", "runtimeValidation")

  // Validation routing: pass → deploy, fail → fix (with retry limit)
  .addConditionalEdges("runtimeValidation", (state) => {
    if (state.validationPassed) {
      return "deployWebsite";
    }
    if (state.retryCount >= 2) {
      // Max retries reached, proceed anyway (errors visible in tasks[])
      return "deployWebsite";
    }
    return "fixWithCodingAgent";
  })

  // Fix loop back to instrumentation
  .addEdge("fixWithCodingAgent", "instrumentation")

  // After website deploy, check if we need to deploy campaign
  .addConditionalEdges("deployWebsite", (state) => {
    return state.deployGoogleAds ? "deployCampaign" : END;
  })

  // Campaign deploy to END
  .addEdge("deployCampaign", END);
