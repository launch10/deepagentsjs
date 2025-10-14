/**
 * Tool for retrieving the website's content strategy from state.
 * 
 * The content strategy contains all the copy components and emotional
 * playbook elements needed to generate consistent, on-brand content
 * for the website.
 * 
 * KEY FEATURES:
 * - Returns the complete content strategy from the website plan
 * - Includes formatted output for easy model consumption
 * - Provides structured data for programmatic access
 * - Handles missing strategy gracefully
 * 
 * USAGE:
 * This tool is typically used when:
 * - Generating new copy for pages or components
 * - Ensuring consistency with the brand voice
 * - Creating content that aligns with emotional drivers
 * - Building CTAs and social proof elements
 */

import { z } from "zod";
import { tool, Tool } from "@langchain/core/tools";
import type { WebsiteBuilderGraphState} from "@shared/state/graph";
import { type WebsiteContentStrategyType } from "@shared/types/website";

const description = `
    Retrieves the website's content strategy for generating consistent, on-brand copy.

    CAPABILITIES:
    • Returns the complete content strategy from the website plan
    • Provides emotional playbook components
    • Includes tone, mood, and visual guidelines
    • Contains pre-written copy elements for reuse

    USE CASES:
    • Generating new page copy
    • Creating consistent CTAs
    • Building social proof sections
    • Maintaining brand voice
    • Aligning with emotional drivers

    RETURNS:
    • Full content strategy object
    • Formatted summary for display
    • Key elements for quick reference
`;

// No input schema needed - this tool just reads from state
const GetContentStrategyInputSchema = z.object({});

type GetContentStrategyInput = z.infer<typeof GetContentStrategyInputSchema>;

const GetContentStrategyOutputSchema = z.object({
    contentStrategy: z.object({
        overallTone: z.string(),
        identifiedCoreEmotionalDriver: z.string(),
        attentionGrabber: z.string(),
        empathyProblemStatement: z.string(),
        emotionalBridge: z.string(),
        productRevealSolutionPitch: z.string(),
        socialProofAngle: z.string(),
        urgencyScarcityHook: z.string(),
        callToAction: z.string(),
        pageMood: z.string(),
        visualEvocation: z.string(),
        synthesizedLandingPageCopy: z.string()
    }).nullable(),
    formattedOutput: z.string(),
    available: z.boolean()
});

type GetContentStrategyOutput = z.infer<typeof GetContentStrategyOutputSchema>;

/**
 * Format the content strategy for display
 */
function formatContentStrategy(strategy: WebsiteContentStrategyType | null | undefined): string {
    if (!strategy) {
        return `Content Strategy: Not Available

The website plan does not have a content strategy defined yet.
This typically happens when:
• The website is still being planned
• The plan was created without content strategy
• The state is incomplete

To generate content, you may need to:
1. Create a content strategy first
2. Use default tone and voice
3. Request the content strategy be added to the plan`;
    }

    return `Content Strategy Overview:

📝 TONE & MOOD
• Overall Tone: ${strategy.overallTone}
• Page Mood: ${strategy.pageMood}
• Visual Style: ${strategy.visualEvocation}

🎯 EMOTIONAL FRAMEWORK
• Core Driver: ${strategy.identifiedCoreEmotionalDriver}
• Attention Grabber: ${strategy.attentionGrabber}
• Problem Statement: ${strategy.empathyProblemStatement}

🌉 TRANSFORMATION JOURNEY
• Emotional Bridge: ${strategy.emotionalBridge}
• Solution Pitch: ${strategy.productRevealSolutionPitch}

✨ CONVERSION ELEMENTS
• Social Proof Angle: ${strategy.socialProofAngle}
• Urgency Hook: ${strategy.urgencyScarcityHook}
• Call to Action: ${strategy.callToAction}
`;
}

export async function initGetContentStrategy(state: GraphState): Promise<{ getContentStrategy: Tool }> {
    // Access the content strategy from the website plan
    const contentStrategy = state.website?.plan?.contentStrategy as WebsiteContentStrategyType | null | undefined;

    async function getContentStrategy(_args: GetContentStrategyInput): Promise<GetContentStrategyOutput> {
        const available = !!contentStrategy;
        const formattedOutput = formatContentStrategy(contentStrategy);

        return {
            contentStrategy: contentStrategy || null,
            formattedOutput,
            available
        };
    }

    const getContentStrategyTool = tool(getContentStrategy, {
        name: "getContentStrategy",
        description,
        schema: GetContentStrategyInputSchema,
    });

    return {
        getContentStrategy: getContentStrategyTool
    };
}

// For backward compatibility, export the old name too
export const initializeTools = initGetContentStrategy;