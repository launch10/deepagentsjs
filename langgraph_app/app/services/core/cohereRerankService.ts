import { CohereClient } from "cohere-ai";
import { env } from "@app";

export interface RerankDocument {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface RerankResult {
  index: number;
  relevanceScore: number;
  document: RerankDocument;
}

export interface RerankOptions {
  topN?: number;
  model?: string;
  returnDocuments?: boolean;
}

export class CohereRerankService {
  private client: CohereClient;
  private defaultModel = "rerank-v3.5";

  constructor() {
    const apiKey = env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error("COHERE_API_KEY is required");
    }
    this.client = new CohereClient({ token: apiKey });
  }

  async rerank(
    query: string,
    documents: RerankDocument[],
    options: RerankOptions = {}
  ): Promise<RerankResult[]> {
    if (documents.length === 0) {
      return [];
    }

    const { topN = 10, model = this.defaultModel } = options;

    const response = await this.client.v2.rerank({
      model,
      query,
      documents: documents.map((doc) => doc.text),
      topN: Math.min(topN, documents.length),
    });

    return response.results
      .filter((result) => documents[result.index] !== undefined)
      .map((result) => ({
        index: result.index,
        relevanceScore: result.relevanceScore,
        document: documents[result.index]!,
      }));
  }

  async rerankWithThreshold(
    query: string,
    documents: RerankDocument[],
    threshold: number = 0.5,
    options: RerankOptions = {}
  ): Promise<RerankResult[]> {
    const results = await this.rerank(query, documents, options);
    return results.filter((result) => result.relevanceScore >= threshold);
  }
}

let instance: CohereRerankService | null = null;

export function getCohereRerankService(): CohereRerankService {
  if (!instance) {
    instance = new CohereRerankService();
  }
  return instance;
}
