import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation } from "@annotation";
import { createEnqueueNode, googleConnectNode, shouldSkipGoogleConnect } from "@nodes";
import { deployCampaignNode } from "../nodes/deploy/deployCampaignNode";

/**
 * Deploy Campaign Graph
 *
 * Flow with skippable GoogleConnect:
 *
 * START
 *   ↓
 * shouldSkipGoogleConnect? ─────────────────┐
 *   │ NO                                    │ YES (already connected)
 *   ↓                                       │
 * enqueueGoogleConnect                      │
 *   ↓                                       │
 * googleConnect ────────────────────────────┤
 *   ↓                                       ↓
 * enqueueDeployCampaign ←───────────────────┘
 *   ↓
 * deployCampaign
 *   ↓
 * END
 */
export const deployCampaignGraph = new StateGraph(DeployAnnotation)
  // Google Connect nodes (skippable)
  .addNode("enqueueGoogleConnect", createEnqueueNode("ConnectingGoogle"))
  .addNode("googleConnect", googleConnectNode)

  // Campaign deploy nodes
  .addNode("enqueueDeployCampaign", createEnqueueNode("LaunchingCampaign"))
  .addNode("deployCampaign", deployCampaignNode)

  // START: Check if Google is already connected
  .addConditionalEdges(START, shouldSkipGoogleConnect, {
    skipGoogleConnect: "enqueueDeployCampaign", // Skip to deploy
    enqueueGoogleConnect: "enqueueGoogleConnect", // Need OAuth
  })

  // Google connect flow
  .addEdge("enqueueGoogleConnect", "googleConnect")
  .addEdge("googleConnect", "enqueueDeployCampaign")

  // Campaign deploy flow
  .addEdge("enqueueDeployCampaign", "deployCampaign")
  .addEdge("deployCampaign", END);
