import { 
    getLLM, 
} from "@core";
import { 
    type TodoType,
    type CodeTaskType,
    type WebsiteType,
    todoListSchema,
    StatusEnum,
    Task,
} from "@types";
import { buildTasksPrompt, toolsPrompt } from "@prompts";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage, BaseMessage } from "@langchain/core/messages";
import { initTools, createStructuredOutputTool, isStructuredOutputTool } from "@tools";
import { db, tasks as tasksTable } from "@db";

export type BuildTasksProps = {
    website: WebsiteType;
    messages: BaseMessage[];
    consoleErrors?: string[];
}

export type BuildTasksOutputType = {
    queue: CodeTaskType[];
}
export class BuildTasksService {
    async execute(input: BuildTasksProps, config?: LangGraphRunnableConfig): Promise<BuildTasksOutputType> {
        const { messages, consoleErrors } = input;
        
        // Get the LLM for planning tasks
        const llm = getLLM("planning");
        
        // Initialize all available tools
        const toolsMap = await initTools(input);
        const desiredTools = ["listFiles", "searchFiles", "getContentStrategy", "submitTaskPlan"];
        
        // Create structured output tool for the final task list
        const structuredOutputTool = createStructuredOutputTool({
            name: "submitTaskPlan",
            description: "Submit the final task plan after analyzing the codebase and user request. IMPORTANT: This should be your LAST action - do not call any other tools after calling this.",
            schema: todoListSchema
        });
        
        // Combine all tools
        const tools = Object.values(toolsMap);
        const allTools = [...tools, structuredOutputTool];
        const selectedTools = allTools.filter(tool => desiredTools.includes(tool.name));
        
        const basePrompt = await buildTasksPrompt({ 
            website: input.website,
            messages,
            consoleErrors 
        });
        const toolsPromptStr = await toolsPrompt({
            tools: selectedTools
        });
        const systemPrompt = `${basePrompt}\n\n${toolsPromptStr}`;
        
        // Create the agent
        const agent = createReactAgent({
            llm,
            tools: selectedTools,
        });
        
        // Prepare agent state with messages
        const agentState = {
            messages: [
                new SystemMessage(systemPrompt),
                ...messages
            ]
        };
        
        // Invoke the agent with recursion limit
        // The agent should naturally stop after submitTaskPlan due to prompt instructions
        const agentConfig = {
            ...config,
            recursionLimit: 15, // Limit iterations - submitTaskPlan should be called within this
        };
        
        await agent.invoke(agentState, agentConfig); 
        
        // Find the structured output tool to get the response
        const outputTool = allTools.find(isStructuredOutputTool);
        const structuredResponse = outputTool?.structuredResponse as TodoListType | undefined;
        
        if (!structuredResponse || !structuredResponse.todos) {
            console.error("Agent did not return the expected structured response format.");
            throw new Error("Agent failed to generate task plan.");
        }

        const codeTasks = structuredResponse.todos.map((todo: TodoType) => {
            return {
                title: todo.title,
                type: Task.TypeEnum.CodeTask,
                subtype: todo.type,
                instructions: todo.instructions,
                path: todo.path,
                status: StatusEnum.PENDING,
            } as CodeTaskType;
        });

        const insertedTasks = await db.insert(tasksTable).values(codeTasks).returning();

        return {
            queue: insertedTasks
        };
    }
}
