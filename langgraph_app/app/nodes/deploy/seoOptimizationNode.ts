import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { Task } from "@types";
import { createCodingAgent } from "@nodes";
import { codingToolsPrompt, environmentPrompt } from "@prompts";
import { ContextAPIService } from "@rails_api";

const TASK_NAME = "SEOOptimization" as const;

/**
 * Build system prompt for SEO optimization AI agent
 */
const buildSystemPrompt = async (state: DeployGraphState, config: LangGraphRunnableConfig) => {
  const mergedState = { ...state, isFirstMessage: false };
  const [tools, environment] = await Promise.all([
    codingToolsPrompt(mergedState, config),
    environmentPrompt(mergedState, config),
  ]);

  return `
    You are an SEO specialist for this website.

    Your task is to optimize the index.html file with proper SEO meta tags for search engines and social media sharing.

    ## Required Meta Tags

    You MUST add or update the following in the <head> section of index.html:

    ### Basic SEO
    - <title> - Keep under 60 characters, compelling and keyword-optimized
    - <meta name="description" content="..."> - 150-160 characters, summarize the page purpose

    ### Open Graph (for Facebook, LinkedIn, etc.)
    - <meta property="og:title" content="..."> - Same as or similar to <title>
    - <meta property="og:description" content="..."> - Same as or similar to meta description
    - <meta property="og:image" content="..."> - MUST be an absolute URL (https://...)
    - <meta property="og:url" content="..."> - The canonical URL of the page
    - <meta property="og:type" content="website">

    ### Twitter Card
    - <meta name="twitter:card" content="summary_large_image">
    - <meta name="twitter:title" content="...">
    - <meta name="twitter:description" content="...">
    - <meta name="twitter:image" content="..."> - MUST be an absolute URL

    ### Additional
    - <link rel="canonical" href="..."> - The canonical URL
    - <link rel="icon" href="..." type="image/x-icon"> - Favicon (use logo if available)

    ## Image Selection

    For og:image and twitter:image:
    - Use an uploaded image if available
    - The image URL MUST be an absolute URL starting with https://
    - If no image is available, you can omit this tag or use a placeholder

    For favicon:
    - Use images marked as "logo" (isLogo: true) for the favicon
    - The favicon URL MUST be an absolute URL starting with https://

    ## Content Guidelines

    - Use the brainstorm data (idea, audience, solution) to craft compelling SEO copy
    - Title should be under 60 characters
    - Description should be 150-160 characters
    - Make the copy engaging and relevant to the target audience

    ${tools}

    ${environment}

    After making changes, reply with: SEO_OPTIMIZED
  `;
};

/**
 * Fetch brainstorm and image context for SEO optimization
 */
async function fetchSEOContext(state: DeployGraphState) {
  if (!state.websiteId || !state.jwt) {
    return { brainstorm: null, images: [] };
  }

  try {
    const contextAPI = new ContextAPIService({ jwt: state.jwt });
    const context = await contextAPI.get(state.websiteId);

    const images = context.uploads.map((upload) => ({
      url: upload.url,
      isLogo: upload.is_logo,
    }));

    return {
      brainstorm: context.brainstorm
        ? {
            idea: context.brainstorm.idea ?? null,
            audience: context.brainstorm.audience ?? null,
            solution: context.brainstorm.solution ?? null,
            socialProof: context.brainstorm.social_proof ?? null,
          }
        : null,
      images,
    };
  } catch (error) {
    console.warn("Failed to fetch SEO context:", error);
    return { brainstorm: null, images: [] };
  }
}

/**
 * SEO Optimization Node
 *
 * Optimizes the landing page with proper meta tags for search engines
 * and social media sharing (Open Graph, Twitter Cards).
 *
 * Uses the coding agent to intelligently generate SEO copy based on
 * brainstorm data and available images.
 */
export const seoOptimizationNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const task = Task.findTask(state.tasks, TASK_NAME);

    if (task?.status === "completed") {
      return {};
    }

    if (!state.websiteId) {
      throw new Error("Missing websiteId");
    }

    try {
      // Fetch brainstorm and images for context
      const { brainstorm, images } = await fetchSEOContext(state);

      // Build user message with context
      let userMessage = `Optimize the index.html file with SEO meta tags.`;

      if (brainstorm) {
        userMessage += `\n\n## Brainstorm Context:\n`;
        if (brainstorm.idea) userMessage += `- Idea: ${brainstorm.idea}\n`;
        if (brainstorm.audience) userMessage += `- Target Audience: ${brainstorm.audience}\n`;
        if (brainstorm.solution) userMessage += `- Solution: ${brainstorm.solution}\n`;
        if (brainstorm.socialProof) userMessage += `- Social Proof: ${brainstorm.socialProof}\n`;
      }

      if (images.length > 0) {
        userMessage += `\n\n## Available Images:\n`;
        images.forEach((img, i) => {
          userMessage += `${i + 1}. ${img.url} ${img.isLogo ? "(logo)" : ""}\n`;
        });
        userMessage += `\nUse one of these images for og:image and twitter:image.`;
      }

      const systemPrompt = await buildSystemPrompt(state, config);

      const agent = await createCodingAgent(
        {
          ...state,
          isFirstMessage: false,
        },
        systemPrompt
      );

      await agent.invoke({
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

      return {
        tasks: [
          {
            ...task,
            status: "completed",
          } as Task.Task,
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        tasks: [
          {
            ...task,
            status: "failed",
            error: `Website ${state.websiteId} not found`,
          } as Task.Task,
        ],
      };
    }
  }
);
