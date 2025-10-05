import { 
  structuredOutputPrompt,
  renderPrompt,
  websiteThemePrompt,
  websiteContentStrategyPrompt,
} from "@prompts";
import { Website, type ThemeType, type ContentStrategyType } from "@types";
import type { BaseMessage } from '@langchain/core/messages';

export interface PlanPagePromptProps {
  contentStrategy: ContentStrategyType;
  userRequest: BaseMessage;
  theme: ThemeType;
}

export const planPagePrompt = async({ contentStrategy, userRequest, theme }: PlanPagePromptProps): Promise<string> => {
  if (!contentStrategy) {
    throw new Error('contentStrategy is required');
  }
  if (!userRequest) {
    throw new Error('userRequest is required');
  }
  if (!theme) {
    throw new Error('theme is required');
  }

  const schema = Website.Page.pagePlanPromptSchema;
  const userInput = userRequest.content;

  const [formatInstructions, themeStr, contentStrategyStr] = await Promise.all([
    structuredOutputPrompt({ schema }),
    websiteThemePrompt({ theme: theme }),
    websiteContentStrategyPrompt({ contentStrategy: contentStrategy }),
  ])

  return renderPrompt(`
      <role>
        You are the Page Planner, an AI that crafts perfect landing page plans.
        You assist another AI (The Code Writer) that creates and modifies web applications, so your role is to provide a high-level plan for the landing page.

        You have also been given suggested copy for the landing page, which you should use to guide your plan.
      </role>

      <instructions>
        1. Think carefully about what the user wants to build. What is their landing page goal? What does it need to communicate?
        2. Use the landing page copy (\`content-strategy\`) the user has provided you to guide your plan: what is the most important information? What is the information hierarchy? How will you communicate this visually?
        3. Then, provide a clear, concise, and well-structured plan that outlines the necessary components and features for the landing page.
        4. Decompose the total structure of a landing page into individual sections that are easy to implement and maintain.
        5. For each section, assign the appropriate copy from the \'content-strategy\'.
        6. For each section, suggest colors, styles, and animations if relevant.
        7. Take pride in keeping each part of the plan simple and elegant, so that The Code Writer can implement it with ease.
        8. ENSURE: Copy is not duplicated across sections.
        9. The goal is to create a beautiful, well-coded application that impresses the user and sets a good foundation for future iterations.
        10. Suggest a background color for EACH section, trying to contrast with the previous section's background color, in order to create a visually appealing and distinct landing page. Use one of Primary, Secondary, White, Muted, Accent, or Neutral.
      </instructions>

      ${themeStr}

      <user-request>
          ${userInput}
      </user-request>

      ${contentStrategyStr}

      ${formatInstructions}
  `);
}