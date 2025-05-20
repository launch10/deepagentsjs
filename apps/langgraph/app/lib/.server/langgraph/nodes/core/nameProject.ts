import { z } from "zod";
import { type GraphState } from "@shared/state/graph";
import { getLlm, LLMSkill, LLMSpeed } from "@langgraph/llm";
import { baseNode } from "@nodes/core/templates/base";
import { PromptTemplate } from "@langchain/core/prompts";
import { CodeManager } from "@services/codeManager";

const schema = z.object({
    projectName: z.string().describe("The unique-name-of-the-project using kebab-case"),
});

const basePrompt = PromptTemplate.fromTemplate(`
    Create a unique name for the project based on the user's request:
    As a rule, prefer shorter names (e.g. "code-stream" instead of "code-stream-landing-page")

    <user-request>
    {userRequest}
    </user-request>
`);

/**
 * Node to brainstorm overall landing page copy using an LLM.
 * Will eventually support Human in the loop
 */
async function nameProject(state: GraphState): Promise<Partial<GraphState>> {
    if (state.projectName) {
        return {
            projectName: state.projectName
        }
    }

    if (!state.userRequest) {
        throw new Error("User request is missing from state.");
    }

    const llm = getLlm(LLMSkill.Writing, LLMSpeed.Fast);
    const structuredLlm = llm.withStructuredOutput(schema);
    const prompt = await basePrompt.format({ userRequest: state.userRequest.content as string });
    const response = await structuredLlm.invoke(prompt);
    const validProjectName = response.projectName.replace(/^\d+/, '')

    const codeManager = new CodeManager(validProjectName);
    const projectName = await codeManager.getUniqueProjectName();

    return {
        projectName: projectName,
        isFirstMessage: true
    };
}

export const nameProjectNode = baseNode({
    nodeName: "nameProject",
    nodeFn: nameProject
});