import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation } from "@annotation";
import {
  createEnqueueNode,
  googleConnectNode,
  shouldSkipGoogleConnect,
  verifyGoogleNode,
  shouldSkipGoogleVerify,
} from "@nodes";
import { deployCampaignNode } from "../nodes/deploy/deployCampaignNode";

/**
 * Deploy Campaign Graph
 *
 * Flow with skippable GoogleConnect and GoogleVerify:
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
 * checkGoogleVerify ←───────────────────────┘
 *   ↓
 * shouldSkipGoogleVerify? ─────────────────┐
 *   │ NO                                   │ YES (already verified)
 *   ↓                                      │
 * enqueueGoogleVerify                      │
 *   ↓                                      │
 * verifyGoogle ────────────────────────────┤
 *   ↓                                      ↓
 * enqueueDeployCampaign ←──────────────────┘
 *   ↓
 * deployCampaign
 *   ↓
 * END
 */
export const deployCampaignGraph = new StateGraph(DeployAnnotation)
  // Google Connect nodes (skippable)
  .addNode("enqueueGoogleConnect", createEnqueueNode("ConnectingGoogle"))
  .addNode("googleConnect", googleConnectNode)

  // Google Verify nodes (skippable)
  .addNode("checkGoogleVerify", async () => ({})) // Pass-through for routing
  .addNode("enqueueGoogleVerify", createEnqueueNode("VerifyingGoogle"))
  .addNode("verifyGoogle", verifyGoogleNode)

  // Campaign deploy nodes
  .addNode("enqueueDeployCampaign", createEnqueueNode("DeployingCampaign"))
  .addNode("deployCampaign", deployCampaignNode)

  // START: Check if Google is already connected
  .addConditionalEdges(START, shouldSkipGoogleConnect, {
    skipGoogleConnect: "checkGoogleVerify", // Skip to verify check
    enqueueGoogleConnect: "enqueueGoogleConnect", // Need OAuth
  })

  // Google connect flow
  .addEdge("enqueueGoogleConnect", "googleConnect")
  .addEdge("googleConnect", "checkGoogleVerify")

  // After connect: Check if Google Ads invite is already accepted
  .addConditionalEdges("checkGoogleVerify", shouldSkipGoogleVerify, {
    skipGoogleVerify: "enqueueDeployCampaign", // Skip to deploy
    enqueueGoogleVerify: "enqueueGoogleVerify", // Need invite verification
  })

  // Google verify flow
  .addEdge("enqueueGoogleVerify", "verifyGoogle")
  .addEdge("verifyGoogle", "enqueueDeployCampaign")

  // Campaign deploy flow
  .addEdge("enqueueDeployCampaign", "deployCampaign")
  .addEdge("deployCampaign", END);
