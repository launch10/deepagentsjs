import { type BrainstormGraphState } from "@state";
import { Brainstorm, type LangGraphRunnableConfig } from "@types";
import { createContextMessage, createMultimodalContextMessage, type ContextMessage } from "langgraph-ai-sdk";

/**
 * Context messages for significant mode SWITCHES in brainstorm.
 *
 * We inject a ContextMessage when there's a real context switch:
 * - Conversational → UI Guidance (all questions answered)
 * - Default → HelpMe (user clicked "help me answer")
 * - Default → DoTheRest (user clicked "finish for me" or has skipped topics)
 *
 * These messages are preserved in traces and help the LLM understand
 * what behavior is expected in the new mode.
 *
 * Regular state (current topic, collected answers) stays in the system prompt
 * to avoid context rot from duplicating info every turn.
 */

export type BrainstormMode = "default" | "helpMe" | "doTheRest" | "uiGuidance" | "finishSkipped";

/**
 * Determine the current brainstorm mode based on state.
 * Exported so it can be used for mode tracking in state.
 */
export const getBrainstormMode = (state: BrainstormGraphState): BrainstormMode => {
  const topic = Brainstorm.getTopic(state.currentTopic as Brainstorm.TopicName);

  // UI mode (all conversational topics answered)
  if (topic?.kind === "ui") {
    // If there are skipped topics, we need to finish them first
    if (state.skippedTopics?.length > 0) {
      return "finishSkipped";
    }
    return "uiGuidance";
  }

  // Conversational mode with special behaviors
  const command = state.command as Brainstorm.AgentBehaviorType | undefined;
  if (command === "helpMe") return "helpMe";
  if (command === "doTheRest") return "doTheRest";

  return "default";
};

/**
 * Get a context message ONLY if we're switching modes.
 * Returns null for regular conversational turns (no switch needed).
 *
 * IMPORTANT: This function accepts pre-computed modes directly.
 * Do NOT pass states and re-compute modes here - the middleware tracks
 * mode changes across model calls and knows when switches actually occur.
 */
export const getBrainstormContextMessage = async (
  state: BrainstormGraphState,
  currentMode: BrainstormMode,
  previousMode: BrainstormMode | undefined,
  config?: LangGraphRunnableConfig
): Promise<ContextMessage | null> => {
  // No switch = no context message needed
  if (!previousMode || currentMode === previousMode) {
    return null;
  }

  // Generate appropriate context message for the mode switch
  switch (currentMode) {
    case "uiGuidance":
      return createUIGuidanceSwitchMessage();
    case "helpMe":
      return createHelpMeSwitchMessage(state);
    case "doTheRest":
      return createDoTheRestSwitchMessage(state);
    case "finishSkipped":
      return createFinishSkippedSwitchMessage(state);
    default:
      return null;
  }
};

/**
 * URL to the brainstorm UI screenshot for visual context.
 * This helps the agent understand exactly what the user sees.
 */
const BRAINSTORM_UI_SCREENSHOT_URL =
  "https://uploads.launch10.ai/uploads/agent_support/brainstorm/brainstorm_ui.png";

/**
 * Context message for switching to UI guidance mode.
 * All conversational questions are answered - now help user personalize or build.
 * Includes a screenshot of the UI so the agent can give accurate guidance.
 */
const createUIGuidanceSwitchMessage = (): ContextMessage => {
  const textContent = `
<context_switch type="ui_guidance">
  MODE: UI Guidance Navigator

  Brainstorming is complete. All questions have been answered successfully.

  The attached screenshot shows exactly what the user sees right now.

  YOUR ROLE: Help the user navigate their two options (visible in the UI):

  1. BRAND PERSONALIZATION PANEL (left sidebar):
     - Logo upload
     - Color palette selection
     - Social links (Twitter, Instagram, LinkedIn, etc.)
     - Custom image uploads
     - All optional - smart defaults will be applied if skipped

  2. "BUILD MY SITE" BUTTON (top right):
     - Generates their landing page immediately
     - They can always customize later

  CRITICAL BEHAVIORS:
  - If user says "I'm finished", "let's build", "build my site" → call finishedTool immediately (no text response)
  - Reference specific UI elements they can see in the screenshot
  - Be brief and encouraging - don't overwhelm with options
  - Make personalization feel optional, not required
  - Create excitement about seeing their page

  FIRST MESSAGE: Celebrate their accomplishment, explain the two options concisely, referencing what they see on screen.
</context_switch>
  `.trim();

  return createMultimodalContextMessage([
    { type: "text", text: textContent },
    { type: "image_url", image_url: { url: BRAINSTORM_UI_SCREENSHOT_URL } },
  ]);
};

/**
 * Context message for switching to "help me answer" mode.
 * User needs structured guidance to answer the current question.
 */
const createHelpMeSwitchMessage = (state: BrainstormGraphState): ContextMessage => {
  const topic = state.currentTopic || "the current question";

  const content = `
<context_switch type="help_me">
  MODE: Help Me Answer

  The user clicked "help me answer" for: ${topic}

  YOUR ROLE: Marketing consultant helping them structure their thinking.

  WHAT TO DO:
  1. Brief acknowledgment (1 sentence, encouraging)
  2. Provide a fill-in-the-blank template with [brackets] for placeholders
  3. Give a concrete, realistic example showing the template filled out

  CRITICAL CONSTRAINTS:
  - Do NOT answer for them - help them structure their OWN answer
  - Keep under 200 words before the example
  - Use simple, jargon-free language
  - Do NOT ask follow-up questions
  - Make the template immediately usable

  OUTPUT FORMAT: JSON with type: "helpMe", text, template, and examples array
</context_switch>
  `.trim();

  return createContextMessage(content);
};

/**
 * Context message for switching to "do the rest" mode.
 * User wants the agent to complete remaining/skipped topics.
 */
const createDoTheRestSwitchMessage = (state: BrainstormGraphState): ContextMessage => {
  const remainingTopics = state.remainingTopics || [];
  const skippedTopics = state.skippedTopics || [];
  const topicsToFinish = [...remainingTopics, ...skippedTopics].filter(
    (t) => t !== "lookAndFeel"
  );

  const content = `
<context_switch type="do_the_rest">
  MODE: Finish For Me

  The user wants you to complete the brainstorm for them.
  Topics to finish: ${topicsToFinish.join(", ") || "none remaining"}

  YOUR ROLE: Marketing consultant creating plausible answers.

  WHAT TO DO:
  1. Review the answers already collected (in system prompt)
  2. Create realistic answers for remaining topics based on what you know
  3. Call save_answers tool with your generated answers

  CRITICAL CONSTRAINTS:
  - Do NOT invent fictional details - extrapolate from provided info
  - Do NOT output text - just call save_answers tool
  - Make answers specific and persuasive, not generic
</context_switch>
  `.trim();

  return createContextMessage(content);
};

/**
 * Context message for finishing skipped topics before UI guidance.
 * Similar to doTheRest but triggered by entering UI mode with skipped topics.
 */
const createFinishSkippedSwitchMessage = (state: BrainstormGraphState): ContextMessage => {
  const skippedTopics = state.skippedTopics || [];

  const content = `
<context_switch type="finish_skipped">
  MODE: Complete Skipped Questions

  User has finished conversational brainstorming but skipped ${skippedTopics.length} question(s).
  Skipped: ${skippedTopics.join(", ")}

  YOUR ROLE: Complete these before moving to page building.

  WHAT TO DO:
  1. Generate plausible answers based on collected information
  2. Call save_answers tool with your generated answers
  3. Do NOT output text - just call the tool

  After saving, they'll transition to UI guidance mode.
</context_switch>
  `.trim();

  return createContextMessage(content);
};
