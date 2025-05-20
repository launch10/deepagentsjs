import { type GraphState } from "@shared/state/graph";
import { codeTaskResultSchema } from "@models/codeTask";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getLlm, LLMSkill } from "@langgraph/llm";
import { HumanMessage } from "@langchain/core/messages";
import { initializeTools as initializeSearchIcons } from "@langgraph/tools/searchIcons";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
interface AgentConfig {
    getPrompt: (state: GraphState) => Promise<string>;
    validateState?: (state: GraphState) => void;
}

export const createCodeAgent = async (agentConfig: AgentConfig) => {
    return async function(state: GraphState, config: LangGraphRunnableConfig) {
        // Run any custom state validation
        if (agentConfig.validateState) {
            agentConfig.validateState(state);
        } else {
            // Default validation
            if (!state.app?.project?.projectName) {
                throw new Error("Project name is required");
            }
            if (!state.task) {
                throw new Error("Task is required");
            }
        }

        const agentState = {
            ...state,
            messages: [new HumanMessage({ content: state.userRequest.content })]
        };

        // Get the configured prompt
        const prompt = await agentConfig.getPrompt(state);

        // Initialize tools
        const { searchIcons } = await initializeSearchIcons(agentState);
        const llm = getLlm(LLMSkill.Coding);
        const tools = [searchIcons];

        // Create and return the agent
        const agent = createReactAgent({
            llm,
            tools,
            prompt,
            responseFormat: codeTaskResultSchema,
        });

        return await agent.invoke(agentState, config);
    }
}