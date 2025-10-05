import { z } from "zod";
import { withCaching } from "@core";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, LLMSpeed, defaultCachePolicy } from "@core";
import { PromptTemplate } from "@langchain/core/prompts";
import { type NotificationOptions } from "@core";
import { structuredOutputPrompt } from "@prompts";
import { withStructuredResponse } from "@utils";

export const projectNameInputSchema = z.object({
    userRequest: z.string().describe("The user's request/description for the project"),
});

export type ProjectNameInput = z.infer<typeof projectNameInputSchema>;

const projectNameOutputSchema = z.object({
    projectName: z.string().describe("The unique-name-of-the-project using kebab-case"),
});

const basePrompt = PromptTemplate.fromTemplate(`
    Create a unique name for the project based on the user's request:
    As a rule, prefer shorter names (e.g. "code-stream" instead of "code-stream-landing-page")
    <user-request>
    {userRequest}
    </user-request>

    {schema}
`);

export const notificationContext: NotificationOptions = {
    taskName: "Generating project name",
};
/**
 * Approach 1: Decorated Class (becomes a Runnable automatically)
 */
export class NameProjectService {
    @withCaching({
        prefix: "projectNameGenerator",
        ...defaultCachePolicy
    })
    async execute(input: ProjectNameInput, config?: LangGraphRunnableConfig): Promise<string> {
        const { userRequest } = input;
        if (!userRequest) {
            throw new Error('User request is required');
        }
        
        const rawResponse = await this.generateRawProjectName(userRequest, LLMSkill.Writing, LLMSpeed.Slow, config);
        const validatedName = this.validateProjectName(rawResponse.projectName);
        const uniqueName = await this.ensureUniqueness(validatedName);
        
        return uniqueName;
    }

    async generateRawProjectName(
        userRequest: string, 
        llmSkill = LLMSkill.Writing, 
        llmSpeed = LLMSpeed.Slow,
        config?: LangGraphRunnableConfig
    ): Promise<{ projectName: string }> {
        const llm = getLlm(llmSkill, llmSpeed);
        const schemaPrompt = await structuredOutputPrompt({ schema: projectNameOutputSchema });
        const prompt = await basePrompt.format({ userRequest, schema: schemaPrompt });
        // const structuredLlm = llm.withStructuredOutput(projectNameOutputSchema);
        // return await structuredLlm.invoke(prompt) as { projectName: string };
        return withStructuredResponse({
            llm,
            prompt,
            schema: projectNameOutputSchema
        })
    }

    validateProjectName(rawName: string): string {
        return rawName.replace(/^\d+/, '');
    }

    async ensureUniqueness(validatedName: string): Promise<string> {
        return validatedName;
    }
}