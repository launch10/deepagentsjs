import { createDeepAgent } from "deepagents";
import { getLLM } from "@core";
import { WebsiteFilesBackend } from "@services";
import { copywriterSubAgent, coderSubAgent } from "./subagents";
import type { CodingAgentGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { db, websites, eq } from "@db";
import type { Website } from "@types";
import { checkpointer } from "@core";
import { toolRetryMiddleware } from "langchain";
import { NodeMiddleware } from "@middleware";

const CODING_AGENT_SYSTEM_PROMPT = `You are an expert landing page developer. You create high-converting landing pages that drive pre-sales signups.

## Your Context

You have access to:
- **Brainstorm**: The user's idea, target audience, solution, and social proof
- **Theme**: 6 primary colors configured in tailwind.config.ts
- **Images**: Uploaded images including logos (from Cloudflare R2)

## Your Tools

1. **Filesystem tools**: ls, read_file, write_file, edit_file, glob, grep
2. **Copywriter subagent**: Use the task tool with subagent_type="copywriter" to draft marketing copy before coding each section

CRITICAL: When using write_file, you MUST provide both parameters:
- file_path: The absolute path (e.g., "/src/components/Hero.tsx")
- content: The COMPLETE file content as a string

Example write_file call:
\`\`\`
write_file(file_path="/src/components/Hero.tsx", content="import React from 'react';\\n\\nexport function Hero() {\\n  return <div>Hero</div>;\\n}")
\`\`\`

NEVER call write_file without the content parameter.

## Workflow

1. **Plan**: Break down the landing page into sections (Hero, Features, Social Proof, CTA, Footer)
2. **Draft copy**: For each section, use the copywriter subagent to draft compelling copy
3. **Code**: Create React components in /src/components/ using the drafted copy
4. **Assemble**: Create the main page in /src/pages/IndexPage.tsx
5. **Verify**: Read files back to confirm they're correct

## Code Guidelines

- Use ONLY shadcn/ui components from the template
- Use ONLY theme color utilities (bg-primary, text-secondary-foreground, etc.)
- Never use hardcoded hex colors
- One component per file, under 150 lines
- Add Posthog tracking to CTAs and signup forms:
  \`\`\`tsx
  onClick={() => posthog.capture('cta_clicked', { section: 'hero' })}
  onSubmit={() => posthog.capture('signup_completed')}
  \`\`\`

## File Structure

\`\`\`
/src
  /components
    Hero.tsx
    Features.tsx
    SocialProof.tsx
    CallToAction.tsx
    Footer.tsx
  /pages
    IndexPage.tsx
\`\`\`

## Theme Colors

Available CSS classes:
- bg-primary, text-primary, text-primary-foreground
- bg-secondary, text-secondary, text-secondary-foreground
- bg-accent, text-accent, text-accent-foreground
- bg-muted, text-muted, text-muted-foreground
- bg-background, text-foreground

Start by exploring the existing template structure with ls and glob, then create the landing page sections.`;

export function createCodingAgent(
  backend: WebsiteFilesBackend,
) {
  const llm = getLLM("coding", "slow", "paid");

  return createDeepAgent({
    model: llm,
    systemPrompt: CODING_AGENT_SYSTEM_PROMPT,
    backend: () => backend,
    subagents: [copywriterSubAgent, coderSubAgent],
    middleware: [toolRetryMiddleware()],
    name: "coding-agent",
    checkpointer,
  });
}

export const codingAgentNode = NodeMiddleware.use({}, async(
  state: CodingAgentGraphState,
  config: LangGraphRunnableConfig,
): Promise<Partial<CodingAgentGraphState>> => {
  if (!state.websiteId || !state.jwt) {
    throw new Error("websiteId and jwt are required");
  }

  const [websiteRow] = await db
    .select()
    .from(websites)
    .where(eq(websites.id, state.websiteId))
    .limit(1);

  if (!websiteRow) {
    throw new Error(`Website ${state.websiteId} not found`);
  }

  const website = websiteRow as Website.WebsiteType;

  // Move to using, so it will auto-cleanup, and add the async cleanup functions!
  const backend = await WebsiteFilesBackend.create({
    website,
    jwt: state.jwt,
  });

  const agent = createCodingAgent(backend);

  const graph = (agent as any).graph || (agent as any)._graph;
  if (graph?.channels?.files) {
    console.log('files channel type:',
  graph.channels.files.constructor.name);
  } else {
    console.log('channels:', Object.keys(graph?.channels ||
  {}));
  }

  const contextMessage = `
## Brainstorm Context
- Idea: ${state.brainstorm.idea || "Not provided"}
- Audience: ${state.brainstorm.audience || "Not provided"}  
- Solution: ${state.brainstorm.solution || "Not provided"}
- Social Proof: ${state.brainstorm.socialProof || "Not provided"}

## Theme
${state.theme ? `Using theme: ${state.theme.name}` : "Using default theme"}

## Images
${state.images.length > 0 ? state.images.map((img) => `- ${img.url}${img.isLogo ? " (logo)" : ""}`).join("\n") : "No images uploaded"}

Please create a landing page based on this context.
`;

  const result = await agent.invoke(
    {
      messages: [
        ...(state.messages || []),
        { role: "user", content: contextMessage },
      ],
    },
    {
      recursionLimit: 100,
      ...config,
    }
  );

  // right... it's supposed to happen here... okay that's not with using. maybe we use finally?
  // await backend.cleanup();

  return {
    messages: result.messages,
    status: "completed",
  };
});