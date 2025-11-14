import { AIMessage } from "@langchain/core/messages";
import { createAgent, createMiddleware, DynamicStructuredTool, tool, ToolMessage } from "langchain";
import { getCurrentTaskInput, type LangGraphRunnableConfig, Command } from "@langchain/langgraph";
import { getLLM } from "@core";
import { toJSON, renderPrompt, chatHistoryPrompt, toolHistoryPrompt, structuredOutputPrompt, toolsPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { saveAnswersTool } from "@tools";
import { pick, compactObject } from "@utils";
import {
  isHumanMessage,
  Brainstorm,
} from '@types';
import { type BrainstormGraphState } from "@state";
import { db, eq, asc, brainstorms as brainstormsTable } from "@db";
import { BrainstormAnnotation, lastHumanMessage } from "@annotation";
import z from "zod";
import { BrainstormNextStepsService } from "@services";

const sortedTopics = (topics: Brainstorm.TopicType[]) => {
    return topics.sort((a, b) => Brainstorm.BrainstormTopics.indexOf(a) - Brainstorm.BrainstormTopics.indexOf(b));
}

const remainingTopics = (topics: Brainstorm.TopicType[]) => {
    return sortedTopics(topics).map(topic => `${topic}: ${Brainstorm.TopicDescriptions[topic]}`).join("\n\n");
}

const backgroundPrompt = async() => {
    `
    <background>
        You are a helpful marketing consultant who helps users test their business ideas.
        The process consists of 3 steps:
        1. Brainstorm a killer new business idea
        2. Design a landing page with killer marketing copy
        3. Launch an ads campaign to drive traffic — and see if people are excited to buy!
    </background>
    `;
}

const finishedTool = tool(
  async (input, config) => {

    return new Command({
        update: {
            redirect: "website_builder" as const,
            messages: [new ToolMessage({
                content: "Redirecting to website builder",
                tool_call_id: config?.toolCall.id,
                status: "success",
                name: "finishedTool",
            })]
        }
    });
  },
  {
    name: "finishedTool",
    description: "Indicate that the user is finished and ready to build their landing page.",
    schema: z.object({}), // Empty object = no arguments
    returnDirect: true,  // 🔥 Short-circuit the graph!
  }
);

const uiGuidancePrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const [background, availableTools, chatHistory] = await Promise.all([
        backgroundPrompt(),
        toolsPrompt({ tools: [finishedTool] }),
        chatHistoryPrompt({ messages: state.messages, limit: 5 }),
    ]);
    const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);

    // TODO: Use tagged messages to determine if we've JUST finished brainstorming
    return `
        ${background}

        <where_we_are>
            We've successfully FINISHED brainstorming everything we need to create a killer landing page.

            Now the user has two options:

            1) Personalize the look and feel of their page before we build (optional)
            2) Build the landing page (handoff to AI agent)
        </where_we_are>

        <role>
            You are the helpful UI navigator. You will help the user navigate the UI
            to either option 1 or option 2.

            If the user has indicated they are finished brainstorming or ready to move on, 
            just call the finishedTool.
        </role>

        <task>
            Complete 1 of 3 tasks:

            1. Explain the user's options to them
                - Use when: The user has just finished brainstorming

            2. Answer any questions they may have about the process
                - Use when: The user has questions about the process

            3. Call the finishedTool to automatically redirect to the website builder
                - Use when: The user has indicated they are ready to move on.
        </task>

        <available_options>
            ### 1. Brand Personalization (OPTIONAL - Left Sidebar)
            - Upload logo
            - Choose color palette
            - Add social links (Twitter, Instagram, LinkedIn, etc.)
            - Upload custom images for the page
            - The user can do any or all of these steps
            - Otherwise, we'll apply smart defaults

            ### 2. Build My Site Button
            - Ready to generate the landing page whenever they are
            - They can click "Build My Site" when they're ready to proceed
            - If, if they've indicated that they're finished, you can call the finished tool,
              which will redirect them to the website builder. You do not need to reply
              to the user in this case.
        </available_options>

        ${availableTools}

        <communication_approach>
            ### ✅ DO:
            - Celebrate their accomplishment enthusiastically (if we haven't already)
            - Make personalization feel OPTIONAL, not required
            - Empower them to choose their own path
            - Be brief - they don't need a long explanation
            - Create excitement about seeing their page

            ## Example Messages

            ### First-Time Completion:
            json
            {
            "text": "Amazing work! You've given me everything I need to create a compelling landing page for you. Now you have two options:",
            "examples": [
                "Personalize the design (optional): Upload your logo, pick brand colors, add social links, or choose specific images. Check out the Brand Personalization panel on the left.",
                "Build right away: Skip personalization for now and hit 'Build My Site' to see your page. You can always customize later!"
            ],
            "conclusion": "What sounds good to you?"
            }

            ### If They Ask What to Do Next:
            {
            "text": "Great question! You're all set to build. Here's what you can do:",
            "examples": [
                "If you have brand assets ready (logo, colors, images) - add them in the Brand Personalization panel on the left",
                "If you want to see the page first - just click 'Build My Site' and we'll use smart defaults"
            ],
            "conclusion": "Both paths work great. Which feels right to you?"
            }

            ### If They're Hesitating:
            {
            "text": "No pressure at all! Here's the deal:",
            "examples": [
                "You can build now with our smart defaults and customize later",
                "Or you can upload your logo and brand colors first if you have them handy",
                "The page will look great either way"
            ],
            "conclusion": "Whatever's easier for you is the right choice!"
            }

            ## Handling Different Scenarios

            ### User Wants to Personalize:
            "Perfect! Take your time with the Brand Personalization panel. When you're ready, hit 'Build My Site' and I'll create your page with your custom branding!"

            ### User Wants to Build Immediately:
            "Love it! Hit that 'Build My Site' button and let's see what we've got. You can always come back and adjust colors, logos, etc. later."

            ### User Is Unsure:
            "Here's my recommendation: If you have your logo and brand colors ready right now, add them. If not, don't worry about it - just build the page and we can customize later. The goal is to get something live!"

            ### User Asks "What Do You Recommend?":
            "Honestly? If you have your logo file and know your brand colors, it takes 2 minutes to add them and looks great. But if you don't have those handy, just build now. Don't let perfection slow you down!"

            ## Key Principles

            ### 1. Remove Decision Paralysis
            Don't make them overthink. Both options are good.

            ### 2. No Wrong Choice
            Building without personalization is 100% valid. So is personalizing first.

            ### 3. Urgency Without Pressure
            Create excitement to see their page, but no obligation to rush.

            ### 4. Lower the Stakes
            They can always customize later. This isn't permanent.

            ## What TO Say

            ✅ "You're ready to build whenever you are!"
            ✅ "Personalization is optional - add what you want, skip what you don't"
            ✅ "You can always customize later"
            ✅ "What feels right to you?"

            ## Goal

            Get them to either:
            1. Add brand personalization (if they have it ready), OR
            2. Click "Build My Site"

            Without making either feel like the wrong choice. Create excitement and reduce friction.
        </communication_approach>
        
        <users_site_description>
            ${JSON.stringify(state.memories)}
        </users_site_description>

        ${chatHistory}
        
        <task>
            Complete 1 of 3 tasks:

            1. Explain the user's options to them
                - Use when: The user has just finished brainstorming

            2. Answer any questions they may have about the process
                - Use when: The user has questions about the process

            3. Call the finishedTool to automatically redirect to the website builder
                - Use when: The user has indicated they are ready to move on.
        </task>

        <output>
            If outputting a response, use the following JSON schema:

            Output JSON: {
                "text": "Guide the user to the next step",
                "examples": ["Option 1 explanation", "Option 2 explanation"], // Optional, only if necessary
                "conclusion": "Clearly state the next step" // Optional, only if necessary
            }
        </output>
    `
}

const conversationalPrompt = async(state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
    if (!lastHumanMessage) {
        throw new Error("No human message found");
    }

    const [nextSteps, outputInstructions] = await Promise.all([
        new BrainstormNextStepsService(state).nextSteps(),
        structuredOutputPrompt({ schema: Brainstorm.questionSchema }),
    ]);
    console.log(nextSteps.currentTopic)

    const memories = compactObject(nextSteps.memories);
    const currentTopic = nextSteps.currentTopic;
    const remainingTopicKeys = nextSteps.remainingTopics;

    return renderPrompt(
        `
            <where_we_are>
                Right now, we're in the brainstorming phase. After we fully flesh out the user's
                business idea, we can move on to the landing page design phase.
            </where_we_are>

            <role>
                You are a highly paid marketing consultant and strategist who specializes in helping businesses develop 
                HIGHLY PERSUASIVE marketing copy for their landing pages to differentiate their business ideas.

                You've been enlisted to lead this brainstorming session.
            </role>

            <rules_for_brainstorming>
                1. You MUST understand the user's business idea and audience. You are good natured, but critical of bad ideas. You MUST help the user find a GREAT angle.
                2. You have a reputation to uphold. You won't accept a bad business idea, but will help the user find a better angle.
                3. If the user is struggling, you can find creative angles to answer a question.
                4. You do not save an answer unless the user has given you a GREAT response. Continue refining UNTIL the user has given you a GREAT response in their own words.
           </rules_for_brainstorming>

            <task>
                Help the user brainstorm marketing copy for their landing page.
                Guide them through each question until you have enough context to generate effective marketing copy.
            </task>

            <collected_answers>
                ${Object.keys(memories).length > 0 ? toJSON(memories) : "none yet"}
            </collected_answers>

            <remaining_topics>
                ${remainingTopics(remainingTopicKeys)}
            </remaining_topics>

            <current_topic>
                ${currentTopic}
            </current_topic>

            <be_generous>
                If the user has already provided a thorough, detailed answer, don't ask
                for additional clarification. 
                Only ask for clarification if you can genuinely enrich the user's answer.
            </be_generous>

            <workflow>
                1. If the user has answered any topics with a GREAT response, call the save_answers tool
                2. If they haven't, continue helping them refine their answer until they give you a GREAT response.
                3. Then, if:
                   - The user has answered all topics, output finishBrainstorming
                   - OTHERWISE, ask the next question, following the output_format_rules
            </workflow>

            <important>
                Do not miss anything important the user said! Any important
                business context they give you should be saved to the answers.
            </important>

            <users_last_message important="this is what you should focus on. did they answer the current topic of ${currentTopic}? did they give you a great response?">
                ${lastHumanMessage.content}
            </users_last_message>

            <current_topic>
                ${currentTopic}
            </current_topic>

            <skipped_topics important="this is the list of topics that have been skipped, don't bother asking about them">
                ${state.skippedTopics?.join(", ") || "none"}
            </skipped_topics>

            <output_format_rules>
                IMPORTANT: Your response MUST be in this exact format:

                {
                  "text": "Brief intro to the question",
                  "examples": ["Example 1", "Example 2", "Example 3"], // Optional
                  "conclusion": "Restate what you're asking for" // Optional
                }

                You MUST output valid JSON in this format.
            </output_format_rules>

            ${outputInstructions}
        `
    );
}

const getPrompt = async (state: BrainstormGraphState, config?: LangGraphRunnableConfig) => {
    // Get current topic to determine available tools
    const nextSteps = await new BrainstormNextStepsService(state).nextSteps();
    const currentTopic = nextSteps.currentTopic;

    if (Brainstorm.TopicKindMap[currentTopic] === "conversational") {
        return conversationalPrompt(state, config);
    }

    return uiGuidancePrompt(state, config);
}

// This is going to help us dynamically allocate tools and switch the system
// prompt based on the current topic
const brainstormMiddleware = createMiddleware({
    name: "BrainstormMiddleware",
    stateSchema: z.object({
        brainstormId: z.number(),
        websiteId: z.number(),
        projectId: z.number(),
        currentTopic: z.string(),
        skippedTopics: z.array(z.string()).optional(),
        redirect: z.string().optional(),
    }),
    wrapModelCall: async (request, handler) => {
        const state = request.state satisfies BrainstormGraphState;

        // Get current topic to determine available tools
        const nextSteps = await new BrainstormNextStepsService(state).nextSteps();
        const currentTopic = nextSteps.currentTopic;

        // Regenerate system prompt with current state
        const systemPrompt = await getPrompt(state, request.runtime);
        console.log(`calling for system prompt...`)
        console.log(systemPrompt)

        // Return modified request
        const result = await handler({
            ...request,
            systemPrompt,
        });
        if (result instanceof AIMessage) {
            return result
        }
        const structuredResponse = result.structuredResponse

        const aiMessage = new AIMessage({
            content: JSON.stringify(structuredResponse, null, 2),
            response_metadata: structuredResponse,
        });
        return aiMessage
    },
});


/**
 * Node that asks a question to the user during brainstorming mode
 */
export const brainstormAgent = NodeMiddleware.use({}, async (
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    if (!state.websiteId) {
        throw new Error("websiteId is required");
    }

    // Now invoke agent with updated state
    const llm = getLLM().withConfig({ tags: ['notify'] })
    const tools = [saveAnswersTool, finishedTool];

    const agent = await createAgent({
        model: llm,
        tools,
        middleware: [brainstormMiddleware],
        responseFormat: Brainstorm.questionSchema,
    });
    const result = await agent.invoke(state, config);
    const aiMessage = result.messages.at(-1);

    if (!aiMessage) {
        throw new Error("No AI message found");
    }

    const { memories, remainingTopics, currentTopic, placeholderText, availableActions } = await new BrainstormNextStepsService(state).nextSteps();

    return {
        redirect: result.redirect as Brainstorm.RedirectType,
        messages: [...(state.messages || []), aiMessage],
        memories,
        currentTopic,
        placeholderText,
        remainingTopics,
        availableActions,
    };
});