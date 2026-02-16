import { type DeployGraphState, withPhases } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Deploy, Task } from "@types";
import { type TaskRunner, registerTask, isTaskDone } from "./taskRunner";
import { db, websiteFiles, websiteUrls, domains, eq, and, withTimestamps } from "@db";
import { isNull } from "drizzle-orm";
import { getLLM, getLogger } from "@core";
import { ContextAPIService } from "@rails_api";
import { HumanMessage } from "@langchain/core/messages";

const TASK_NAME: Deploy.TaskName = "OptimizingPageForLLMs";

const LLMS_TXT_PATH = "public/llms.txt";

/**
 * Check if llms.txt already exists for this website
 */
async function llmsTxtExists(websiteId: number): Promise<boolean> {
  const existing = await db
    .select({ path: websiteFiles.path })
    .from(websiteFiles)
    .where(
      and(
        eq(websiteFiles.websiteId, websiteId),
        eq(websiteFiles.path, LLMS_TXT_PATH),
        isNull(websiteFiles.deletedAt)
      )
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Get the domain URL for this website via websiteUrls + domains tables
 */
async function getDomainUrl(websiteId: number): Promise<string | null> {
  const result = await db
    .select({ domain: domains.domain })
    .from(websiteUrls)
    .innerJoin(domains, eq(websiteUrls.domainId, domains.id))
    .where(
      and(
        eq(websiteUrls.websiteId, websiteId),
        isNull(websiteUrls.deletedAt),
        isNull(domains.deletedAt)
      )
    )
    .limit(1);

  const domain = result[0]?.domain;
  if (!domain) return null;

  return `https://${domain}`;
}

/**
 * Generate llms.txt using a cheap LLM call + brainstorm context.
 * The Homepage link is added programmatically, not by the LLM.
 */
async function generateLlmsTxt(state: DeployGraphState, siteUrl: string): Promise<string> {
  const contextAPI = new ContextAPIService({ jwt: state.jwt! });
  const context = await contextAPI.get(state.websiteId!);

  const brainstorm = context.brainstorm;
  if (!brainstorm) {
    return `# Landing Page\n> A landing page built with Launch10\n\n## About\n- [Homepage](${siteUrl}/)\n`;
  }

  let brainstormContext = "";
  if (brainstorm.idea) brainstormContext += `- Business Idea: ${brainstorm.idea}\n`;
  if (brainstorm.audience) brainstormContext += `- Target Audience: ${brainstorm.audience}\n`;
  if (brainstorm.solution) brainstormContext += `- Solution: ${brainstorm.solution}\n`;
  if (brainstorm.social_proof) brainstormContext += `- Social Proof: ${brainstorm.social_proof}\n`;

  const llm = await getLLM({ skill: "writing", speed: "blazing", cost: "paid", maxTier: 5 });

  const prompt = `Generate a concise llms.txt file for a landing page following the llmstxt.org spec.

Here is the brainstorm context:
${brainstormContext}

Output ONLY the llms.txt content in this exact format (no code fences, no explanation):

# {Business Name}
> {One-line description}

## Key Information
- Target Audience: {audience}
- Value Proposition: {main benefit}

IMPORTANT:
- Do NOT include any links or URLs — those will be added separately.
- Do NOT include an "About" section.
- Keep it concise (under 10 lines total).`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const llmContent = typeof response.content === "string" ? response.content : String(response.content);

  // Programmatically append the Homepage link
  return `${llmContent.trim()}\n\n## About\n- [Homepage](${siteUrl}/)\n`;
}

/**
 * Write a file to the websiteFiles table
 */
async function writeFile(websiteId: number, path: string, content: string): Promise<void> {
  await db
    .insert(websiteFiles)
    .values(withTimestamps({ websiteId, path, content }));
}

/**
 * LLMs.txt Node
 *
 * Generates llms.txt for deployed sites using brainstorm data.
 * robots.txt and sitemap.xml are handled by the build tool (Buildable).
 * Only generates if llms.txt doesn't already exist.
 */
async function runOptimizePageForLLMs(
  state: DeployGraphState,
  _config?: LangGraphRunnableConfig
): Promise<Partial<DeployGraphState>> {
  const task = Task.findTask(state.tasks, TASK_NAME);

  if (task?.status === "completed") {
    return {};
  }

  if (!state.websiteId) {
    throw new Error("Missing websiteId");
  }

  try {
    if (await llmsTxtExists(state.websiteId)) {
      getLogger().info("llms.txt already exists, skipping generation");
      return withPhases(state, [{ ...task, status: "completed" } as Task.Task]);
    }

    const siteUrl = await getDomainUrl(state.websiteId);
    if (!siteUrl) {
      getLogger().warn("No domain found for website, skipping llms.txt generation");
      return withPhases(state, [{ ...task, status: "completed" } as Task.Task]);
    }

    const content = await generateLlmsTxt(state, siteUrl);
    await writeFile(state.websiteId, LLMS_TXT_PATH, content);
    getLogger().info("Generated llms.txt");

    return withPhases(state, [{ ...task, status: "completed" } as Task.Task]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    getLogger().error({ err: error }, "llms.txt generation failed");
    return withPhases(state, [
      { ...task, status: "failed", error: errorMessage } as Task.Task,
    ]);
  }
}

/**
 * LLMs.txt Task Runner
 */
export const optimizePageForLLMsTaskRunner: TaskRunner = {
  taskName: TASK_NAME,

  readyToRun: (state: DeployGraphState) => {
    return isTaskDone(state, "RuntimeValidation");
  },

  shouldSkip: (state: DeployGraphState) => {
    return !Deploy.shouldDeployWebsite(state);
  },

  run: runOptimizePageForLLMs,
};

registerTask(optimizePageForLLMsTaskRunner);
