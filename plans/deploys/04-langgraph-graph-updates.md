# Langgraph Graph Updates

## Updated deployCampaign Graph

```typescript
// langgraph_app/app/graphs/deployCampaign.ts

import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation } from "@annotation";
import {
  createEnqueueNode,
  googleConnectNode,
  shouldSkipGoogleConnect,
  verifyGoogleNode,
  shouldSkipGoogleVerify
} from "@nodes";
import { deployCampaignNode } from "../nodes/deploy/deployCampaignNode";

/**
 * Deploy Campaign Graph
 *
 * Flow with skippable Google steps:
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
 * shouldSkipGoogleVerify? ──────────────────┐
 *   │ NO                                    │ YES (already verified)
 *   ↓                                       │
 * enqueueGoogleVerify                       │
 *   ↓                                       │
 * verifyGoogle ─────────────────────────────┤
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

  // Google Verify nodes (skippable)
  .addNode("checkGoogleVerify", async () => ({})) // pass-through for routing
  .addNode("enqueueGoogleVerify", createEnqueueNode("VerifyingGoogle"))
  .addNode("verifyGoogle", verifyGoogleNode)

  // Campaign deploy nodes
  .addNode("enqueueDeployCampaign", createEnqueueNode("DeployingCampaign"))
  .addNode("deployCampaign", deployCampaignNode)

  // START: Check if Google is already connected
  .addConditionalEdges(START, shouldSkipGoogleConnect, {
    skipGoogleConnect: "checkGoogleVerify",      // Skip to verify check
    enqueueGoogleConnect: "enqueueGoogleConnect", // Need OAuth
  })

  // Google connect flow
  .addEdge("enqueueGoogleConnect", "googleConnect")
  .addEdge("googleConnect", "checkGoogleVerify")

  // After connect: Check if invite already accepted
  .addConditionalEdges("checkGoogleVerify", shouldSkipGoogleVerify, {
    skipGoogleVerify: "enqueueDeployCampaign",   // Skip to deploy
    enqueueGoogleVerify: "enqueueGoogleVerify",  // Need invite
  })

  // Google verify flow
  .addEdge("enqueueGoogleVerify", "verifyGoogle")
  .addEdge("verifyGoogle", "enqueueDeployCampaign")

  // Deploy campaign flow
  .addEdge("enqueueDeployCampaign", "deployCampaign")
  .addEdge("deployCampaign", END);
```

## State Annotation Update

Add `deployId` to the deploy annotation:

```typescript
// langgraph_app/app/annotation/deployAnnotation.ts

import { Annotation } from "@langchain/langgraph";

export const DeployAnnotation = Annotation.Root({
  // ... existing fields ...

  // NEW: Deploy record ID from Rails
  deployId: Annotation<number | undefined>({
    default: () => undefined,
    reducer: (_, next) => next,
  }),
});

export type DeployGraphState = typeof DeployAnnotation.State;
```

## Node Exports

Update the node index to export new functions:

```typescript
// langgraph_app/app/nodes/index.ts

// Google connect
export {
  googleConnectNode,
  isGoogleConnected,
  shouldSkipGoogleConnect
} from "./deploy/googleConnectNode";

// Google verify (NEW)
export {
  verifyGoogleNode,
  isGoogleVerified,
  shouldSkipGoogleVerify
} from "./deploy/verifyGoogleNode";
```

## Graph Registration

Ensure the graph is registered in the graph registry:

```typescript
// langgraph_app/app/graphs/index.ts

export { deployCampaignGraph } from "./deployCampaign";

// In the registry:
const graphs = {
  // ... other graphs ...
  deployCampaign: deployCampaignGraph,
};
```

## Initial State from Frontend

When starting the deploy flow, pass the deployId:

```typescript
// Frontend: Starting the deploy flow
const startDeployFlow = async (deployId: number) => {
  const response = await fetch("/langgraph/threads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`
    },
    body: JSON.stringify({
      graph: "deployCampaign",
      input: {
        deployId,
        projectId: project.id,
        accountId: account.id,
        // ... other initial state
      }
    })
  });
};
```
