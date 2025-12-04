import { z } from "zod";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM, type LLMSkill, type LLMSpeed } from "@core";
import { PromptTemplate } from "@langchain/core/prompts";
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

// export const notificationContext: NotificationOptions = {
//     taskName: "Generating project name",
// };
/**
 * Approach 1: Decorated Class (becomes a Runnable automatically)
 */
export class NameProjectService {
    async execute(input: ProjectNameInput, config?: LangGraphRunnableConfig): Promise<string> {
        const { userRequest } = input;
        if (!userRequest) {
            throw new Error('User request is required');
        }
        
        const llm = getLLM("writing", "blazing");
        const schemaPrompt = await structuredOutputPrompt({ schema: projectNameOutputSchema });
        const prompt = await basePrompt.format({ userRequest, schema: schemaPrompt });

        return withStructuredResponse({
            llm,
            prompt,
            schema: projectNameOutputSchema
        }).then((response) => response.projectName);
    }
}