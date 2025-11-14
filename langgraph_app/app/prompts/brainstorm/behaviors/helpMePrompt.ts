import fs from "fs";
import path from "path";
import { type BrainstormGraphState } from "@state";
import { Brainstorm, type LangGraphRunnableConfig, isHumanMessage } from "@types";
import { structuredOutputPrompt, renderPrompt } from "@prompts";
import {
    whereWeArePrompt,
    currentTopicPrompt,
    remainingTopicsPrompt,
    collectedAnswersPrompt,
    backgroundPrompt,
} from "../core";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const helpMePrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
    if (!lastHumanMessage) {
        throw new Error("No human message found");
    }

    const topicSpecificHelp = fs.readFileSync(path.join(__dirname, `../help/${state.currentTopic}.md`), 'utf-8');
    const [outputInstructions, whereWeAre, currentTopic, remainingTopics, collectedAnswers, background] = await Promise.all([
        structuredOutputPrompt({ schema: Brainstorm.helpMeSchema }),
        whereWeArePrompt(state, config),
        currentTopicPrompt(state, config),
        remainingTopicsPrompt(state, config),
        collectedAnswersPrompt(state, config),
        backgroundPrompt(state, config),
    ]);

    return renderPrompt(
        `
            ${background}

            ${whereWeAre}

            <context>
                The user has clicked "help me answer" on a specific question because they need more guidance on how to respond. They are not asking you to answer FOR them, but to help them structure their own thinking.
            </context>

            <role>
                You are a highly paid marketing consultant and strategist who specializes in helping businesses develop 
                HIGHLY PERSUASIVE marketing copy for their landing pages to differentiate their business ideas.
            </role>
            
            <task>
                Provide a clear, fill-in-the-blank template that helps them articulate their answer with specificity and clarity.
            </task>

            <output_format_rules>
                1. **Brief acknowledgment** (1 sentence max)

                - Encouraging and supportive
                - Examples: "No problem! Let me help you structure this." or "Sure! Let me break this down for you."

                2. **Structured template or framework**

                - Provide clear fill-in-the-blank placeholders using [brackets]
                - OR break the question into 3-4 sub-questions with placeholders
                - Include brief guidance for what should go in each placeholder
                - Keep explanatory text minimal - let the structure do the work

                3. **Concrete, realistic example** (REQUIRED)
                - Must demonstrate the template/framework filled out completely
                - Should be realistic and relatable, not overly creative or niche
                - Must show how all pieces connect together
            </output_format_rules>

            TONE REQUIREMENTS:

            - Helpful and encouraging, never condescending
            - Conversational but professional
            - Like a business coach or advisor, not a teacher
            - Assume they're smart but just need structure

            CRITICAL CONSTRAINTS:

            - Keep your response under 200 words total (before the example)
            - Use simple, jargon-free language - no marketing or business buzzwords
            - Do NOT ask follow-up questions
            - Do NOT offer to help further or ask if they need clarification
            - Do NOT answer the question for them or guess at their answer
            - The template/structure should be immediately usable
            - Focus entirely on STRUCTURE, not on generating ideas for them

            OUTPUT FORMAT:
            Your response will be displayed in a chat interface and the template portion may be pre-filled into an input box for them to edit. Make sure the template is clearly delineated from your explanation.

            QUALITY SELF-CHECK:
            Before providing your response, verify:
            ✓ Is there a clear template or framework they can fill in?
            ✓ Does my example show the template properly filled out?
            ✓ Does my example use any information we've already collected to help think through the answer for THEIR business?
            ✓ Can someone with no business background follow this?
            ✓ Is this MORE helpful than just rephrasing the original question?

            ${collectedAnswers}

            ${remainingTopics}

            ${currentTopic}

            ${topicSpecificHelp}

            <task>
                Provide a clear, fill-in-the-blank template that helps them articulate their answer with specificity and clarity.
            </task>

            <output_format_rules>
                IMPORTANT: Your response MUST be in this exact format:

                {
                  "type": "helpMe",
                  "text": "Brief acknowledgement",
                  "template": "Structured template or framework",
                  "examples": ["Example 1", "Example 2", "Example 3"],
                }

                You MUST output valid JSON in this format.
            </output_format_rules>

            ${outputInstructions}
        `
    );
}