import { 
    structuredOutputPrompt,
    renderPrompt,
} from "@prompts";

import { todoListSchema, } from "@types";
import { BaseMessage } from "@langchain/core/messages";
import { lastHumanMessage } from "@annotation";
import type { WebsiteType, FileType } from "@types";
import { CodeFileModel, FileSpecificationModel } from "@models";

export interface BuildTasksProps {
    consoleError: string | undefined;
    messages: BaseMessage[];
    website: WebsiteType;
}

export const buildTasksPrompt = async ({ 
    consoleError,
    messages,
    website
}: BuildTasksProps): Promise<string> => {
    const userRequest = lastHumanMessage({messages});
    if (!userRequest) {
        throw new Error('userRequest is required');
    }
    const userInput = userRequest.content;
    if (!userInput) {
        throw new Error('userInput is required');
    }
    if (!website) {
        throw new Error('website is required');
    }

    const sectionTypes = await FileSpecificationModel.all();
    const [structuredOutputStr, websiteFiles] = await Promise.all([
        structuredOutputPrompt({ schema: todoListSchema }),
        CodeFileModel.where({ websiteId: website.id, sourceType: "WebsiteFile"})
    ]);
    const websiteFilePaths = websiteFiles.map((file: FileType) => file.path);

    return renderPrompt(`
        <role>
            You are an expert AI software engineering manager. 
        </role>

        <task>
            Your goal is to decompose a user's request into a set of tasks that 
            can be completed by a team of AI agents.

            A SEPARATE agent will be responsible for tackling each task you provide.
        </task>

        <task-types>
          - BUG_FIX: The user has requested a fix for a bug in the code.
          - UPDATE: The user has requested an update to existing code.
          - CREATE_COMPONENT: The user has requested a new page section (such as a Hero Banner, Feature List, etc.) 
            that does not already exist in the codebase.
          - CREATE_PAGE: The user has requested a new page (such as a Pricing, Contact Us, etc.) 
            that does not already exist in the codebase.
        </task-types>

        <instructions>
          1. Understand the user's request.
          2. Use the \`searchFiles\` tool to read files in the existing codebase, 
          if necessary.
          3. (If necessary): Analyze the files you found and inform your plan based 
          on what you find.
          4. For each task, generate a list of which files need to be created 
          and/or modified, 
          and a set of instructions for each file.
          5. If you need to generate a new section, you can use the 
          \`getContentStrategy\` tool to learn about the content strategy for 
          the website overall.
          6. If you plan to a CREATE_COMPONENT task, be sure to also
          generate a detailed set of instructions the agent can use to create
          the component. This should include where to add the section to the 
          page, content, layout, etc.
          7. If the user requests GLOBAL style changes (e.g. change the primary 
          site color to blue), you should modify the index.css file and/or 
          tailwind.config.ts file.
          8.  **IMPORTANT**: Your final output MUST be structured according 
          to the required format. For each task you, provide the full set
          of files that need to be modified, and the **complete**, instructions 
          required for each file modification.
          9.  **IMPORTANT**: Each file will be processed by a SEPARATE worker. 
          They WILL NOT have access to other workers' changes or context. 
          Ensure EACH agent has ALL the information it needs to complete its 
          task in the INSTRUCTION you provide.
          10. **CRITICAL**: When you have analyzed the codebase and are ready to submit your task plan:
              a. Call the submitTaskPlan tool with your complete task list
              b. The submitTaskPlan tool should be your FINAL action - DO NOT call any other tools after it
              c. Once you call submitTaskPlan, your work is complete
        </instructions>

        <user-request>
            ${userRequest.content}
        </user-request>

        <existing-files>
          ${websiteFilePaths.map((path: string) => `<file>${path}</file>`).join('\n')}
        </existing-files>

        <when-to-choose-each-component>
          If you need a CREATE_COMPONENT task, you should choose from the list of 
          component templates we provide that best matches the user's request.
          <component-types>
            ${sectionTypes.map((section) => {
              return `<component type="${section.componentType}">${section.description}</component>`;
            }).join('')}
          </component-types>
        </when-to-choose-each-component>

        ${
          consoleError && `
          <console-error>
            ${consoleError}
          </console-error>
          `
        }

        <task>
            Your goal is to decompose a user's request into a set of tasks that 
            can be completed by a team of AI agents.
            
            IMPORTANT: The submitTaskPlan tool is your way to submit the final task list. 
            It should be the LAST tool you call. After calling it, do NOT call any other tools.
        </task>

        ${structuredOutputStr}
    `);
};