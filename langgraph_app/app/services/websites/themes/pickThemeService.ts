import { z } from "zod";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, defaultCachePolicy, withCaching } from "@core";
import { pickThemePrompt, type PickThemePromptProps, pickThemePromptOutputSchema, toolsPrompt } from "@prompts";
import { initTools, createStructuredOutputTool, isStructuredOutputTool } from "@tools";
import { StructuredTool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { SearchThemesService } from "./searchThemesService";
import { themeSchema, type WebsiteType } from "@types";
import { WebsiteModel } from "@models";

const pickThemeOutputSchema = z.object({
    theme: themeSchema
});

export type PickThemeOutputType = z.infer<typeof pickThemeOutputSchema>;

export type PickThemeProps = PickThemePromptProps & {
    website: WebsiteType;
}; 
export class PickThemeService {
    @withCaching({
      prefix: "pickTheme",
      ...defaultCachePolicy
    })
    async execute(input: PickThemeProps, config?: LangGraphRunnableConfig): Promise<PickThemeOutputType> {
        const userRequest = input.userRequest;

        if (!userRequest) {
            throw new Error('User request is required');
        }

        const website = input.website;
        if (!website) {
            throw new Error('Website is required');
        }
        
        const llm = getLlm(LLMSkill.Planning);
        
        const themePrompt = await pickThemePrompt(input);
        
        const { searchThemes } = await initTools(input);
        const structuredOutputTool = createStructuredOutputTool({
            name: "submitThemeSelection",
            description: "Submit your final theme selection. Call this AFTER searching for themes and choosing the best one.",
            schema: pickThemePromptOutputSchema.extend({
                reason: z.string().optional().describe("Brief explanation of why you chose this theme")
            })
        });
        
        const tools: StructuredTool[] = [structuredOutputTool, searchThemes];
        
        const agent = createReactAgent({
            llm,
            tools,
        });

        // Add instruction to use both tools
        const toolInstructions = await toolsPrompt({ tools });

        const instructions = new HumanMessage(`
            Process:
            1. Call searchThemes with relevant labels (2-3 labels max)
            2. Review the returned themes and their IDs
            3. Call submitThemeSelection with the themeId of your chosen theme
            
            You MUST call submitThemeSelection to complete the task.
        `);
        
        // Update agent state with tool instructions
        const agentStateWithInstructions = {
            messages: [
                new SystemMessage(themePrompt),
                new HumanMessage(toolInstructions),
                new HumanMessage(instructions),
                userRequest
            ]
        };

        const agentOutput = await agent.invoke(agentStateWithInstructions, config);
        
        // Get the result from the structured output tool using type guard
        const outputTool = tools.find(isStructuredOutputTool);
        const structuredResponse = outputTool?.structuredResponse;
        
        if (!structuredResponse || !('themeId' in structuredResponse)) {
            throw new Error('No theme selection found');
        }
        
        const themeId = structuredResponse.themeId as number;
        const theme = await new SearchThemesService().findThemeById(themeId);

        if (!theme) {
            throw("Returned invalid theme")
        }

        await WebsiteModel.update(website.id, { themeId: theme.id });

        return {
            theme
        }
    }
}
