import { Worker, Job } from "bullmq";
import { z } from "zod";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createRedisConnection } from "../queues/connection";
import type { DocumentExtractionJobData } from "../queues/documentExtraction";
import { WebhookService } from "../services/webhooks";
import { getLLM } from "@core";
import { withStructuredResponse } from "@utils";
import { structuredOutputPrompt } from "@prompts";

const qaExtractionSchema = z.object({
  pairs: z.array(
    z.object({
      question: z.string().describe("The question being asked"),
      answer: z.string().describe("The answer to the question"),
      section: z.string().optional().describe("The section or category this Q&A belongs to"),
    })
  ),
});

type QAPair = z.infer<typeof qaExtractionSchema>["pairs"][number];
type QAExtractionResult = z.infer<typeof qaExtractionSchema>;

const QA_EXTRACTION_PROMPT = `You are an expert at extracting question and answer pairs from documentation.

Your task is to identify all Q&A pairs in the provided content. Look for:
- Explicit "Question:" and "Answer:" patterns
- FAQ-style content with questions followed by explanations
- Any content that follows a question-answer format

Guidelines:
- Extract the complete question and complete answer
- Preserve the original wording as much as possible
- Identify the section/category each Q&A belongs to based on context (e.g., "Headlines", "Ad Group Name", "Budget")
- Do not make up or infer Q&As that aren't in the content
- If a Q&A appears to be cut off at chunk boundaries, still extract what you can see
- If you see a partial Q&A that continues from a previous chunk (answer without question), skip it

Return all complete Q&A pairs found in this chunk.`;

const CHUNK_SIZE = 3000;
const CHUNK_OVERLAP = 500;

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  separators: ["\nQuestion:", "\n\n", "\n", " ", ""],
});

async function splitContent(content: string): Promise<string[]> {
  const docs = await textSplitter.createDocuments([content]);
  return docs.map((doc: { pageContent: string }) => doc.pageContent);
}

async function extractQAFromChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  schemaPrompt: string,
  metadata?: Record<string, unknown>
): Promise<QAPair[]> {
  const llm = getLLM("writing", "fast");

  const prompt = `${QA_EXTRACTION_PROMPT}

${schemaPrompt}

<chunk index="${chunkIndex + 1}" of="${totalChunks}">
${chunk}
</chunk>

${metadata?.title ? `Document title: ${metadata.title}` : ""}

Extract all complete Q&A pairs from this chunk.`;

  const result = (await withStructuredResponse({
    llm,
    prompt,
    schema: qaExtractionSchema,
  })) as QAExtractionResult;

  return result.pairs;
}

function deduplicateQAPairs(pairs: QAPair[]): QAPair[] {
  const seen = new Map<string, QAPair>();

  for (const pair of pairs) {
    const key = pair.question.toLowerCase().trim();
    const existing = seen.get(key);

    if (!existing || pair.answer.length > existing.answer.length) {
      seen.set(key, pair);
    }
  }

  return Array.from(seen.values());
}

async function processDocumentExtraction(job: Job<DocumentExtractionJobData>) {
  const { job_run_id, document_id, content, metadata } = job.data;

  console.log(`[Worker] Processing document ${document_id}`);

  const schemaPrompt = await structuredOutputPrompt({ schema: qaExtractionSchema });
  const chunks = await splitContent(content);

  console.log(`[Worker] Split into ${chunks.length} chunks, processing in parallel`);

  const results = await Promise.allSettled(
    chunks.map((chunk, i) => extractQAFromChunk(chunk, i, chunks.length, schemaPrompt, metadata))
  );

  const successfulPairs = results
    .filter((r): r is PromiseFulfilledResult<QAPair[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  const failedCount = results.filter((r) => r.status === "rejected").length;
  if (failedCount > 0) {
    console.warn(`[Worker] ${failedCount}/${chunks.length} chunks failed`);
  }

  const dedupedPairs = deduplicateQAPairs(successfulPairs);
  console.log(`[Worker] Extracted ${dedupedPairs.length} unique Q&A pairs`);

  await WebhookService.sendWebhook({
    job_run_id,
    document_id,
    status: "success",
    result: { pairs: dedupedPairs },
  });

  return { pairs_count: dedupedPairs.length, failed_chunks: failedCount };
}

const connection = createRedisConnection();

export const documentExtractionWorker = new Worker<DocumentExtractionJobData>(
  "document-extraction",
  processDocumentExtraction,
  {
    connection,
    concurrency: 3,
    autorun: true,
  }
);

documentExtractionWorker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

documentExtractionWorker.on("failed", async (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);

  if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
    await WebhookService.sendWebhook({
      job_run_id: job.data.job_run_id,
      document_id: job.data.document_id,
      status: "failure",
      result: { error: err.message },
    });
  }
});

documentExtractionWorker.on("error", (err) => {
  console.error("[Worker] Error:", err);
});

process.on("SIGINT", async () => {
  console.log("[Worker] Shutting down...");
  await documentExtractionWorker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Worker] Shutting down...");
  await documentExtractionWorker.close();
  process.exit(0);
});

console.log("[Worker] Document extraction worker started");
