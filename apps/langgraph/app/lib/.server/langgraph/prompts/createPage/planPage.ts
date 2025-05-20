import type { GraphState } from "@shared/state/graph";
import { type ContentStrategy } from "@models/project/projectPlan";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { pagePlanSchema } from "@models/page";
import stringify from "fast-json-stable-stringify";

const formatContentStrategy = (contentStrategy: ContentStrategy) => {
    if (!contentStrategy) {
      throw new Error("Content strategy is required");
    }

    return `
        <content-idea name="attention-grabber" likely-section="hero"> 
          ${contentStrategy.attentionGrabber}
        </content-idea>
        <content-idea name="empathy-problem-statement"> 
          ${contentStrategy.empathyProblemStatement}
        </content-idea>
        <content-idea name="emotional-bridge"> 
          ${contentStrategy.emotionalBridge}
        </content-idea>
        <content-idea name="product-reveal-solution-pitch" likely-section="features"> 
          ${contentStrategy.productRevealSolutionPitch}
        </content-idea>
        <content-idea name="social-proof-angle" likely-section="socialProof"> 
          ${contentStrategy.socialProofAngle}
        </content-idea>
        <content-idea name="urgency-scarcity-hook" likely-section="pricing"> 
          ${contentStrategy.urgencyScarcityHook}
        </content-idea>
        <content-idea name="call-to-action" likely-section="call-to-action"> 
          ${contentStrategy.callToAction}
        </content-idea>
        <synthesized-copy>
          ${contentStrategy.synthesizedLandingPageCopy}
        </synthesized-copy>
        <page-mood>
          ${contentStrategy.pageMood}
        </page-mood>
        <visual-evocation>
          ${contentStrategy.visualEvocation}
        </visual-evocation>
    `;
};

export const planPagePrompt = async (state: GraphState): Promise<string> => {
  if (!state.app.project?.projectPlan?.contentStrategy) {
    throw new Error("Content strategy is required");
  }

  const sectionPlanSchema = pagePlanSchema.pick({ sections: true, description: true });
  const parser = StructuredOutputParser.fromZodSchema(sectionPlanSchema);
  const formatInstructions = parser.getFormatInstructions();

  return Promise.resolve(`
      <role>
        You are the Page Planner, an AI that crafts perfect landing page plans.
        You assist another AI (The Code Writer) that creates and modifies web applications, so your role is to provide a high-level plan for the landing page.

        You have also been given suggested copy for the landing page, which you should use to guide your plan.
      </role>

      <instructions>
        1. Think carefully about what the user wants to build. What is their landing page goal? What does it need to communicate?
        2. Use the landing page copy (<content-strategy>) the user has provided you to guide your plan: what is the most important information? What is the information hierarchy? How will you communicate this visually?
        3. Then, provide a clear, concise, and well-structured plan that outlines the necessary components and features for the landing page.
        4. Decompose the total structure of a landing page into individual sections that are easy to implement and maintain.
        5. For each section, assign the appropriate copy from the <content-strategy>.
        6. For each section, suggest colors, styles, and animations if relevant.
        7. Take pride in keeping each part of the plan simple and elegant, so that The Code Writer can implement it with ease.
        8. ENSURE: Copy is not duplicated across sections.
        9. The goal is to create a beautiful, well-coded application that impresses the user and sets a good foundation for future iterations.
        10. Suggest a background color for EACH section, trying to contrast with the previous section's background color, in order to create a visually appealing and distinct landing page. Use one of Primary, Secondary, White, Muted, Accent, or Neutral.
      </instructions>

      <theme>
        ${stringify(state.app.project?.projectPlan?.theme)}
      </theme>

      <user-request>
          ${state.userRequest.content as string}
      </user-request>

      <content-strategy>
        ${formatContentStrategy(state.app.project.projectPlan.contentStrategy)}
      </content-strategy>

      <output>
        ${formatInstructions}
      </output>
    `);
}