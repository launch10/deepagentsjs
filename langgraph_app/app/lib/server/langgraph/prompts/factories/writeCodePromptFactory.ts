import { PromptTemplate } from "@langchain/core/prompts";
import { createPromptFactory } from "@prompts/factories";
import { codeTaskResultSchema, type CodeTask } from "@models/codeTask";
import { type GraphState } from "@shared/state/graph";
import { formatBrandInfo } from "@langgraph/prompts/helpers";
import { formatFiles } from "@prompts/helpers";
import { formatObject } from "@prompts/helpers";
import { FileSpecification } from "@models/fileSpecification";
import { designGuidelines } from "~/lib/server/langgraph/prompts/helpers/context/designGuidelines";
import { type FileMap } from "@models/file";
import { highLevelPrinciples, lowLevelPrinciples } from "~/lib/server/langgraph/prompts/helpers/context/principles";

export const baseCreatePrompt = PromptTemplate.fromTemplate(`
        <role>
            {role}
        </role>

        <task>
            {task}
        </task>

        <section-plan>
            {contentPlan}
        </section-plan>

        <instructions>
            {instructions}
            {additionalInstructions}
        </instructions>

        <design-principles>
            {highLevelPrinciples}
            {lowLevelPrinciples}
        </design-principles>

        <important>
            {important}
        </important>

        <context>
            {context}
        </context>

        <user-request>
            {userRequest}
        </user-request>

        <files>
            {files}
        </files>

        <task>
            Reminder — This is your task: {task}
        </task>

        <section-plan>
            Reminder — This is your section plan: {contentPlan}
        </section-plan>
`);


const role = `You are a Code Generation Agent. Your task is to take a detailed plan for a React component and generate the corresponding TSX using Shadcn UI and Tailwind CSS.
The goal is to create beautiful, responsive, and production-ready code based *strictly* on the provided plan and design guidelines.`;
const task = `Generate the React/TSX code for the section detailed below.`;
const instructions = `
    1.  **Analyze Input:** Carefully review the provided <section-plan> (in JSON format), <brand-guidelines>, and <design-guidelines>.
    2.  **Frameworks:** Use React, TypeScript, Shadcn UI, and Tailwind CSS ONLY.
    3.  **Content Integration:** Implement the content exactly as specified in the <section-plan>. Use details from <contentDetails>, <ctaButtons>, <items>, etc.
    4.  **Styling:** Implement visualStyleNotes described in the <content-plan> using Tailwind CSS classes. Adhere strictly to the <theme> provided in the <brand-guidelines>.
    5.  **Layout:** Implement the <layoutDescription> and respect the <visualEmphasis>.
    6.  **Responsiveness:** Implement <responsivenessNotes>. Ensure the component looks good and functions correctly on various screen sizes.
    7.  **Shadcn UI:** Utilize Shadcn UI components. They are pre-installed. Some components may have been suggested in the <suggested-components> list.
    9.  **Imports:** Include all necessary imports for React, Shadcn components, Lucide icons (if used), etc.
    10. **Dependencies:** List any *new* npm package dependencies required beyond the standard stack (React, Next.js, Tailwind, Shadcn UI, Lucide-react). Usually, this should be empty.
    11. **Code Quality:** Generate clean, readable, well-formatted, and strongly-typed code. Include comments only where necessary for complex logic.
    12. **Strict Adherence:** Follow the plan precisely. Do NOT add features, content, or styling not specified in the plan or guidelines. Do NOT invent image URLs or icons. Use only provided Lucide icons or Unsplash URLs.
    13. **Output Format:** Your final output MUST strictly adhere to the required JSON schema structure. Ensure the 'code' field contains ONLY the valid TSX code as a single string.
`;
const important = `This is perhaps THE most important section of the landing page, so make it visually compelling and scannable! This will make or break the user's decision to convert.`;

export const writeCodePromptFactory = createPromptFactory({
    template: baseCreatePrompt,
    schema: codeTaskResultSchema,
    getDefaults: async (state: GraphState) => {
        const fileSpec = state.task.fileSpec;
        if (!fileSpec) {
            throw new Error("Cannot generate write code prompt: task.fileSpec is missing.");
        }
        const type = fileSpec?.subtype;
        const fileSpecModel = FileSpecification.create(fileSpec);
        const expectedComponentName = fileSpecModel.subtype;
        const languageString = fileSpecModel.languageString; 
        const componentInstruction = expectedComponentName ? `**Component Name:** Create a component named: ${expectedComponentName}. Give the component an ID of ${expectedComponentName}, so that it can be used as an anchor for links.` : '';
        const namedExportInstruction = expectedComponentName ? `**Use Named Export:** Export the component as ${expectedComponentName}. DO NOT USE default export.` : '';
        const extraConstraints = `The name field must exactly match: ${expectedComponentName}`;
        const important = `Ensure: All imports are correct, and the component is exported as ${expectedComponentName}.`;

        const context = {
            "landing-page-summary": state.app.project?.projectPlan.summary,
            "design-guidelines": designGuidelines
        }
        const additionalInstructions = {
            componentInstruction,
            namedExportInstruction
        };

        const files: FileMap = {};

        // Intentionally excluded to raise errors if forgotten;
        // contentPlan: "", // Always should be overridden by the specific prompt
        return {
            role,
            task,
            type,
            languageString,
            instructions,
            important,
            context,
            files,
            additionalInstructions,
            extraConstraints,
            userRequest: state.userRequest.content as string,
            highLevelPrinciples,
            lowLevelPrinciples
        }
    },
    formatters: {
        additionalInstructions: (values: Record<string, any>): string => {
            return formatObject(values.additionalInstructions);
        },
        files: (values: Record<string, any>): string => {
            return formatFiles(values.files, [...Object.keys(values.files)]);
        },
        context: (values: Record<string, any>): string => {
            return formatObject(values.context);
        }
    }
});