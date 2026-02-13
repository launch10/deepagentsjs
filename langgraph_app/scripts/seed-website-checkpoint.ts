#!/usr/bin/env tsx
/**
 * Seed a Langgraph checkpoint for a website thread.
 *
 * Used by the Rails snapshot builder (spec/snapshot_builders/website_generated.rb)
 * to populate the checkpoint store so that loadHistory returns valid state.
 *
 * Usage:
 *   NODE_ENV=test npx tsx scripts/seed-website-checkpoint.ts --thread-id=<uuid> --website-id=<id>
 */
import { StateGraph, START, END } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AIMessage } from "@langchain/core/messages";
import { WebsiteAnnotation } from "@annotation";
import { db, codeFiles, eq } from "@db";
import { env } from "../app/core/env";
import type { Website } from "@types";

// Parse CLI args
const args = process.argv.slice(2);
const threadId = args.find((a) => a.startsWith("--thread-id="))?.split("=")[1];
const websiteId = args.find((a) => a.startsWith("--website-id="))?.split("=")[1];
const chatId = args.find((a) => a.startsWith("--chat-id="))?.split("=")[1];

if (!threadId || !websiteId) {
  console.error("Usage: seed-website-checkpoint.ts --thread-id=<uuid> --website-id=<id> [--chat-id=<id>]");
  process.exit(1);
}

const websiteIdNum = parseInt(websiteId, 10);
const chatIdNum = chatId ? parseInt(chatId, 10) : undefined;

// 1. Read files from DB (same query as syncFilesNode)
const generatedFiles = await db
  .select()
  .from(codeFiles)
  .where(eq(codeFiles.websiteId, websiteIdNum));

const files: Website.FileMap = generatedFiles.reduce((acc, file) => {
  acc[file.path!] = {
    content: file.content!,
    created_at: file.createdAt!,
    modified_at: file.updatedAt!,
  };
  return acc;
}, {} as Website.FileMap);

console.log(`Found ${Object.keys(files).length} files for website ${websiteId}`);

// 2. Build a minimal graph with the same annotation schema
const noop = () => ({});
const minimalGraph = new StateGraph(WebsiteAnnotation)
  .addNode("noop", noop)
  .addEdge(START, "noop")
  .addEdge("noop", END);

// 3. Compile with a fresh checkpointer pointing at the test DB
const checkpointer = PostgresSaver.fromConnString(env.DATABASE_URL);
await checkpointer.setup();

const compiled = minimalGraph.compile({ checkpointer });

// 4. Write checkpoint via updateState
const config = { configurable: { thread_id: threadId } };

await compiled.updateState(config, {
  messages: [new AIMessage("I've built your landing page!")],
  files,
  status: "completed",
  websiteId: websiteIdNum,
  ...(chatIdNum ? { chatId: chatIdNum } : {}),
});

console.log(`Checkpoint seeded for thread ${threadId}`);

// Clean up DB connections
process.exit(0);
