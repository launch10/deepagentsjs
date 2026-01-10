import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation, type DeployGraphState } from "@annotation";
import { Deploy } from "@types";
import { deployWebsiteGraph } from "./deployWebsite";
import { deployCampaignGraph } from "./deployCampaign";

// Helper to check task status
const getTaskStatus = (state: DeployGraphState, name: string) =>
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
  .addNode("deployWebsite", deployWebsiteGraph as any)
  .addNode("deployCampaign", deployCampaignGraph as any)

  // Start: check flags, exit early if nothing to deploy
  .addConditionalEdges(START, (state) => {
    if (!Deploy.shouldDeployAnything(state)) return END; // No-op
    if (Deploy.shouldDeployWebsite(state)) return "deployWebsite";
    return "deployCampaign";
  })

  .addConditionalEdges("deployWebsite", (state) => {
    // if did deploy successfully + shouldDeployCampaign, then deploy campaign, else end
  })

  // Campaign deploy to END
  .addEdge("deployCampaign", END);
