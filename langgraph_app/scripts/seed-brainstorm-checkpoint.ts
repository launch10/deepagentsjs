#!/usr/bin/env tsx
/**
 * Seed a Langgraph checkpoint for a brainstorm thread.
 *
 * Used by the Rails snapshot builders to populate the checkpoint store
 * so that loadHistory returns valid state and the brainstorm graph
 * recognises the project already exists (skips createBrainstorm).
 *
 * Usage:
 *   NODE_ENV=test npx tsx scripts/seed-brainstorm-checkpoint.ts \
 *     --thread-id=<uuid> --website-id=<id> --brainstorm-id=<id> \
 *     --project-id=<id> --chat-id=<id>
 */
import { StateGraph, START, END } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AIMessage } from "@langchain/core/messages";
import { BrainstormAnnotation } from "@annotation";
import { env } from "../app/core/env";

// Parse CLI args
const args = process.argv.slice(2);
const threadId = args.find((a) => a.startsWith("--thread-id="))?.split("=")[1];
const websiteId = args.find((a) => a.startsWith("--website-id="))?.split("=")[1];
const brainstormId = args.find((a) => a.startsWith("--brainstorm-id="))?.split("=")[1];
const projectId = args.find((a) => a.startsWith("--project-id="))?.split("=")[1];
const chatId = args.find((a) => a.startsWith("--chat-id="))?.split("=")[1];

if (!threadId || !websiteId || !brainstormId || !projectId) {
  console.error(
    "Usage: seed-brainstorm-checkpoint.ts --thread-id=<uuid> --website-id=<id> --brainstorm-id=<id> --project-id=<id> [--chat-id=<id>]"
  );
  process.exit(1);
}

const websiteIdNum = parseInt(websiteId, 10);
const brainstormIdNum = parseInt(brainstormId, 10);
const projectIdNum = parseInt(projectId, 10);
const chatIdNum = chatId ? parseInt(chatId, 10) : undefined;

// Build a minimal graph with the brainstorm annotation schema
const noop = () => ({});
const minimalGraph = new StateGraph(BrainstormAnnotation)
  .addNode("noop", noop)
  .addEdge(START, "noop")
  .addEdge("noop", END);

// Compile with a fresh checkpointer pointing at the test DB
const checkpointer = PostgresSaver.fromConnString(env.DATABASE_URL);
await checkpointer.setup();

const compiled = minimalGraph.compile({ checkpointer });

// Write checkpoint via updateState
const config = { configurable: { thread_id: threadId } };

const messageContent =
  "Let's brainstorm your next big idea. Tell me about the business or product you're working on — what problem does it solve, and who is it for?";
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
  websiteId: websiteIdNum,
  brainstormId: brainstormIdNum,
  projectId: projectIdNum,
  currentTopic: "idea",
  ...(chatIdNum ? { chatId: chatIdNum } : {}),
});

console.log(`Brainstorm checkpoint seeded for thread ${threadId}`);

// Clean up DB connections
process.exit(0);
