import { z } from "zod";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { pickThemePrompt, type PickThemePromptProps, toolsPrompt } from "@prompts";
import { initWebsiteTools } from "app/tools/website";
import { StructuredTool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { SearchThemesService } from "./searchThemesService";
import { themeSchema, type WebsiteType } from "@types";
import { WebsiteModel } from "@models";
import { structuredOutputPrompt } from "@prompts";

const pickThemeOutputSchema = z.object({
    theme: themeSchema
});

export type PickThemeOutputType = z.infer<typeof pickThemeOutputSchema>;

export type PickThemeProps = PickThemePromptProps & {
    website: WebsiteType;
}; 
export class PickThemeService {
    async execute(input: PickThemeProps, config?: LangGraphRunnableConfig): Promise<PickThemeOutputType> {
        const userRequest = input.userRequest;

        if (!userRequest) {
            throw new Error('User request is required');
        }

        const website = input.website;
        if (!website || !website.id || (typeof website.id !== 'number')) {
            throw new Error('Website is required');
        }
        
        const llm = getLLM("planning");
        
        const themePrompt = await pickThemePrompt(input);
        
        const { searchThemes } = await initWebsiteTools(input as any); // TODO: Fix this
        if (!searchThemes) {
            throw new Error('Failed to initialize searchThemes tool');
        }
        
        const tools: StructuredTool[] = [searchThemes];
        
        const agent = createAgent({
            model: llm,
            tools,
            responseFormat: pickThemeOutputSchema
        });

        // Add instruction to use both tools
        const toolInstructions = await toolsPrompt({ tools });

        const instructions = new HumanMessage(`
            Process:
            1. Call searchThemes with relevant labels (2-3 labels max)
            2. Review the returned themes and their IDs
            3. Submit your final theme selection using the structure listed below:
            
            ${await structuredOutputPrompt({ schema: pickThemeOutputSchema })}
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
        const structuredResponse = agentOutput.structuredResponse;
        
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
