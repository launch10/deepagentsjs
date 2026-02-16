#!/usr/bin/env tsx
/**
 * Seed a Langgraph checkpoint for a deploy thread.
 *
 * Used by the Rails snapshot builder (spec/snapshot_builders/website_deploy_step.rb)
 * to populate the checkpoint store so that loadHistory returns valid deploy state.
 *
 * Usage:
 *   NODE_ENV=test npx tsx scripts/seed-deploy-checkpoint.ts \
 *     --thread-id=<uuid> --deploy-id=<id> --website-id=<id> --chat-id=<id> --result-url=<url>
 */
import { StateGraph, START, END } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AIMessage } from "@langchain/core/messages";
import { DeployAnnotation } from "@annotation";
import { Deploy } from "@types";
import { env } from "../app/core/env";

// Parse CLI args
const args = process.argv.slice(2);
const threadId = args.find((a) => a.startsWith("--thread-id="))?.split("=")[1];
const deployId = args.find((a) => a.startsWith("--deploy-id="))?.split("=")[1];
const websiteId = args.find((a) => a.startsWith("--website-id="))?.split("=")[1];
const chatId = args.find((a) => a.startsWith("--chat-id="))?.split("=")[1];
const resultUrl = args.find((a) => a.startsWith("--result-url="))?.split("=")[1];

if (!threadId || !deployId || !websiteId || !chatId || !resultUrl) {
  console.error(
    "Usage: seed-deploy-checkpoint.ts --thread-id=<uuid> --deploy-id=<id> --website-id=<id> --chat-id=<id> --result-url=<url>"
  );
  process.exit(1);
}

const deployIdNum = parseInt(deployId, 10);
const websiteIdNum = parseInt(websiteId, 10);
const chatIdNum = parseInt(chatId, 10);

// Build completed website-only tasks
// Website tasks: ValidateLinks, RuntimeValidation, FixingBugs, OptimizingSEO, AddingAnalytics, DeployingWebsite
const websiteTaskNames = Deploy.findTasks({ website: true });
const completedTasks = websiteTaskNames.map((name) => {
  const task = Deploy.createTask(name);
  // FixingBugs is skipped (only runs on validation failure)
  if (name === "FixingBugs") {
    return { ...task, status: "skipped" as const };
  }
  return { ...task, status: "completed" as const };
});

// Compute phases from the completed tasks
const phases = Deploy.computePhases(completedTasks);

console.log(`Tasks: ${completedTasks.map((t) => `${t.name}:${t.status}`).join(", ")}`);
console.log(`Phases: ${phases.map((p) => `${p.name}:${p.status}`).join(", ")}`);

// Build a minimal graph with the DeployAnnotation schema
const noop = () => ({});
const minimalGraph = new StateGraph(DeployAnnotation)
  .addNode("noop", noop)
  .addEdge(START, "noop")
  .addEdge("noop", END);

// Compile with a fresh checkpointer pointing at the test DB
const checkpointer = PostgresSaver.fromConnString(env.DATABASE_URL);
await checkpointer.setup();

const compiled = minimalGraph.compile({ checkpointer });

// Write checkpoint via updateState
const config = { configurable: { thread_id: threadId } };

const messageContent = "Your website has been deployed successfully!";
const message = new AIMessage({
  content: messageContent,
  response_metadata: {
    parsed_blocks: [
      {
        type: "text",
        index: 0,
        id: crypto.randomUUID(),
        sourceText: messageContent,
      },
    ],
  },
});

await compiled.updateState(config, {
  messages: [message],
  deployId: deployIdNum,
  websiteId: websiteIdNum,
  chatId: chatIdNum,
  status: "completed",
  instructions: { website: true },
  result: { url: resultUrl },
  tasks: completedTasks,
  phases,
});

console.log(`Deploy checkpoint seeded for thread ${threadId}`);

// Clean up DB connections
process.exit(0);
