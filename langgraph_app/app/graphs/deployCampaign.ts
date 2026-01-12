import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation } from "@annotation";
import { createEnqueueNode } from "@nodes";
import { deployCampaignNode } from "../nodes/deploy/deployCampaignNode";

export const deployCampaignGraph = new StateGraph(DeployAnnotation)
  .addNode("enqueueDeployCampaign", createEnqueueNode("CampaignDeploy"))
  .addNode("deployCampaign", deployCampaignNode)

  .addEdge(START, "enqueueDeployCampaign")
  .addEdge("enqueueDeployCampaign", "deployCampaign")
  .addEdge("deployCampaign", END);
