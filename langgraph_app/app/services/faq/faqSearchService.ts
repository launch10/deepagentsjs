import { sql, and, eq, inArray } from "drizzle-orm";
import { OpenAIEmbeddings } from "@langchain/openai";
import { db } from "@db";
import { documentChunks, documents } from "app/db/schema";
import { CohereRerankService, type RerankDocument } from "../core/cohereRerankService";
import { env } from "@core";

export interface FAQSearchOptions {
  topK?: number;
  documentType?: string;
  status?: "live" | "draft";
  rerankTopN?: number;
  rerankThreshold?: number;
  tags?: string[];
}

export interface FAQSearchResult {
  id: number;
  question: string;
  answer: string;
  section: string | null;
  documentId: number;
  documentTitle: string | null;
  documentSlug: string;
  tags: string[];
  relevanceScore: number;
}
export class FAQSearchService {
  private embeddingModel: OpenAIEmbeddings;
  private rerankService: CohereRerankService | null = null;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required");
    }
    if (!env.COHERE_API_KEY) {
      console.warn("COHERE_API_KEY is not set. Reranking will be disabled.");
    }

    this.embeddingModel = new OpenAIEmbeddings({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
    });

    if (env.COHERE_API_KEY) {
      this.rerankService = new CohereRerankService();
    }
  }

  async search(query: string, options: FAQSearchOptions = {}): Promise<FAQSearchResult[]> {
    const {
      topK = 10,
      documentType,
      status = "live",
      rerankTopN = topK,
      rerankThreshold,
      tags,
    } = options;

    const queryEmbedding = await this.embeddingModel.embedQuery(query);

    const conditions = [eq(documents.status, status)];

    if (documentType) {
      conditions.push(eq(documents.documentType, documentType));
    }

    let candidateResults = await db
      .select({
        id: documentChunks.id,
        question: documentChunks.question,
        answer: documentChunks.answer,
        section: documentChunks.section,
        content: documentChunks.content,
        documentId: documentChunks.documentId,
        documentTitle: documents.title,
        documentSlug: documents.slug,
        tags: documents.tags,
        similarity: sql<number>`1 - (${documentChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(and(...conditions))
      .orderBy(sql`${documentChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
      .limit(topK * 2);

    if (candidateResults.length === 0) {
      return [];
    }

    if (tags && tags.length > 0) {
      candidateResults = candidateResults.filter((r) =>
        (r.tags as string[]).some((tag) => tags.includes(tag))
      );
    }

    if (!this.rerankService) {
      return candidateResults.slice(0, topK).map((r) => ({
        id: r.id,
        question: r.question,
        answer: r.answer,
        section: r.section,
        documentId: r.documentId,
        documentTitle: r.documentTitle,
        documentSlug: r.documentSlug,
        tags: (r.tags as string[]) || [],
        relevanceScore: r.similarity,
      }));
    }

    const rerankDocs: RerankDocument[] = candidateResults.map((r) => ({
      text: r.content || `${r.question}\n\n${r.answer}`,
      metadata: {
        id: r.id,
        question: r.question,
        answer: r.answer,
        section: r.section,
        documentId: r.documentId,
        documentTitle: r.documentTitle,
        documentSlug: r.documentSlug,
        tags: r.tags,
      },
    }));

    const reranked = rerankThreshold
      ? await this.rerankService.rerankWithThreshold(query, rerankDocs, rerankThreshold, {
          topN: rerankTopN,
        })
      : await this.rerankService.rerank(query, rerankDocs, { topN: rerankTopN });

    return reranked.map((r) => ({
      id: r.document.metadata?.id as number,
      question: r.document.metadata?.question as string,
      answer: r.document.metadata?.answer as string,
      section: r.document.metadata?.section as string | null,
      documentId: r.document.metadata?.documentId as number,
      documentTitle: r.document.metadata?.documentTitle as string | null,
      documentSlug: r.document.metadata?.documentSlug as string,
      tags: (r.document.metadata?.tags as string[]) || [],
      relevanceScore: r.relevanceScore,
    }));
  }

  formatResultsAsContext(results: FAQSearchResult[]): string {
    if (results.length === 0) {
      return "No relevant FAQ entries found.";
    }

    return results
      .map(
        (r, i) =>
          `[${i + 1}] Q: ${r.question}\nA: ${r.answer}${r.section ? `\n(Section: ${r.section})` : ""}`
      )
      .join("\n\n");
  }
}

let instance: FAQSearchService | null = null;

export function getFAQSearchService(): FAQSearchService {
  if (!instance) {
    instance = new FAQSearchService();
  }
  return instance;
}
