import { type GraphState } from "@state"
import { NameProjectService } from "@services";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { lastHumanMessage } from "@annotation";
import { BaseNode } from "@core";

/**
 * Node that generates a project name based on the user's request
 */
class NameProjectNode extends BaseNode<GraphState> {
    async execute(
        state: GraphState, 
        config?: LangGraphRunnableConfig
    ): Promise<Partial<GraphState>> {
        if (!state.messages) {
            throw new Error("messages are required");
        }

        const content = lastHumanMessage({messages: state.messages})?.content;
        if (!content) {
            throw new Error('User request is required');
        }
        
        // Extract text from content (handles both string and complex content)
        const userRequest = typeof content === 'string' 
            ? content 
            : content.map(c => 'text' in c ? c.text : '').join('');
        
        const projectNameGenerator = new NameProjectService();
        const projectName = await projectNameGenerator.execute({ userRequest }, config);
        return { projectName };
    }
}

// Export as a function for use in the graph
export const nameProjectNode = new NameProjectNode().toNodeFunction();