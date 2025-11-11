import { AIMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { toJSON, renderPrompt, chatHistoryPrompt, structuredOutputPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { SaveAnswersTool } from "@tools";
import { pick } from "@utils";
import {
  isHumanMessage,
  Brainstorm,
} from '@types';
import { type BrainstormGraphState } from "@state";
import { db, eq, asc, brainstorms as brainstormsTable } from "@db";

/**
 * Node that asks a question to the user during brainstorming mode
 */
export const createWebsite = NodeMiddleware.use({}, async (
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    return {}
  }
});