import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation, type DeployGraphState } from "@annotation";
import { Deploy, Task } from "@types";
import { deployWebsiteGraph } from "./deployWebsite";
import { deployCampaignGraph } from "./deployCampaign";

// Compile subgraphs for use as nodes
const compiledWebsiteGraph = deployWebsiteGraph.compile();
const compiledCampaignGraph = deployCampaignGraph.compile();

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
 * deployWebsite subgraph (if deployWebsite)
 *   ↓
 *   ├── (if WebsiteDeploy completed && shouldDeployGoogleAds) → deployCampaign
 *   ├── (if WebsiteDeploy failed) → END
 *   └── (else) → END
 *   ↓
 * deployCampaign subgraph (if deployGoogleAds)
 *   ↓
 * END
 */
export const deployGraph = new StateGraph(DeployAnnotation)
  .addNode("deployWebsite", compiledWebsiteGraph)
  .addNode("deployCampaign", compiledCampaignGraph)

  // Start: check flags, exit early if nothing to deploy
  .addConditionalEdges(START, (state) => {
    if (!Deploy.shouldDeployAnything(state)) return END; // No-op
    if (Deploy.shouldDeployWebsite(state)) return "deployWebsite";
    return "deployCampaign";
  })

  // After website deploy: check if we should proceed to campaign
  .addConditionalEdges("deployWebsite", (state) => {
    const websiteTask = Task.findTask(state.tasks, "WebsiteDeploy");

    // If website deploy failed, don't proceed to campaign
    if (websiteTask?.status === "failed") return END;

    // If website deploy not yet completed, exit (waiting for webhook)
    if (websiteTask?.status !== "completed") return END;

    // Website completed - proceed to campaign if needed
    if (Deploy.shouldDeployGoogleAds(state)) return "deployCampaign";

    return END;
  })

  // Campaign deploy to END
  .addEdge("deployCampaign", END);
