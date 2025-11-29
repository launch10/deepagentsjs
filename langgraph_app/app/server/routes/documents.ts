import { Hono } from 'hono';
import { z } from 'zod';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { getLLM } from '@core';
import { withStructuredResponse } from '@utils';
import { structuredOutputPrompt } from '@prompts';

const qaExtractionSchema = z.object({
  pairs: z.array(z.object({
    question: z.string().describe('The question being asked'),
    answer: z.string().describe('The answer to the question'),
    section: z.string().optional().describe('The section or category this Q&A belongs to, e.g. "Headlines", "Ad Group Name"'),
  }))
});

export type QAPair = z.infer<typeof qaExtractionSchema>['pairs'][number];
export type QAExtractionResult = z.infer<typeof qaExtractionSchema>;

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
  separators: [
    '\nQuestion:',
    '\n\n',
    '\n',
    ' ',
    ''
  ],
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
  metadata?: Record<string, string>
): Promise<QAPair[]> {
  const llm = getLLM('writing', 'fast');
  
  const prompt = `${QA_EXTRACTION_PROMPT}

${schemaPrompt}

<chunk index="${chunkIndex + 1}" of="${totalChunks}">
${chunk}
</chunk>

${metadata?.title ? `Document title: ${metadata.title}` : ''}

Extract all complete Q&A pairs from this chunk.`;

  const result = await withStructuredResponse({
    llm,
    prompt,
    schema: qaExtractionSchema
  }) as QAExtractionResult;

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

export const documentsRoutes = new Hono();

documentsRoutes.post('/extract-qa', adminAuthMiddleware, async (c) => {
  const body = await c.req.json();
  const { content, metadata } = body;

  if (!content || typeof content !== 'string') {
    return c.json({ error: 'content is required and must be a string' }, 400);
  }

  const schemaPrompt = await structuredOutputPrompt({ schema: qaExtractionSchema });
  const chunks = await splitContent(content);
  
  const allPairs: QAPair[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    const pairs = await extractQAFromChunk(chunk, i, chunks.length, schemaPrompt, metadata);
    allPairs.push(...pairs);
  }

  const dedupedPairs = deduplicateQAPairs(allPairs);

  return c.json({ pairs: dedupedPairs });
});

documentsRoutes.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'documents' });
});
