import { StateGraph, END, START } from "@langchain/langgraph";
import { LaunchAnnotation } from "@annotation";
import { deployCampaignNode } from "@nodes";

/**
 * Launch Graph
 *
 * This graph handles campaign deployment by:
 * 1. Triggering a Rails job to deploy the campaign
 * 2. Waiting for the job to complete via webhook callback
 * 3. Processing the job result (success or failure)
 *
 * The graph uses the interrupt/resume pattern:
 * - First invocation: triggers job, interrupts to wait
 * - Second invocation (from webhook): processes job result
 */
export const launchGraph = new StateGraph(LaunchAnnotation)
  .addNode("deployCampaign", deployCampaignNode)
  .addEdge(START, "deployCampaign")
  .addEdge("deployCampaign", END);
