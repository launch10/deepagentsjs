import { 
    renderPrompt,
    type PromptMetadata
} from "@prompts";
import { allStructuredTools } from "@tools";
import { StructuredTool } from "@langchain/core/tools";

type ToolMap = Record<string, StructuredTool>;
export interface ToolsPromptProps {
  tools: StructuredTool[] | ToolMap;
}

export const toolsPrompt = async ({ 
    tools,
}: ToolsPromptProps): Promise<string> => {
    if (!tools) {
        throw new Error('tools is required');
    }
    let toolsArray;

    if (!Array.isArray(tools)) {
        toolsArray = Object.values(tools).sort((a, b) => a.name.localeCompare(b.name));
    } else {
        toolsArray = tools;
    }

    if (!allStructuredTools(toolsArray)) {
        throw new Error('toolsPrompt requires tools to implement StructuredToolInterface');
    }

    const toolInstructions = toolsArray.map(tool => {
        return `
            <important>
                You have ${toolsArray.length} tools available:
            </important>

            <tool>
              <name>${tool.name}</name>
              <description>${tool.description}</description>
            </tool>
        `;
    }).join('\n');

    return renderPrompt(`
        <tools>
            ${toolInstructions}
        </tools>
    `);
};

toolsPrompt.promptMetadata = {
    name: 'Tools Prompt',
    category: 'Core',
    description: 'Generates a prompt for a list of tools',
    examples: []
} as PromptMetadata;