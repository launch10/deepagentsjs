import { type GraphState } from "@shared/state/graph";
import { type FileMap } from "@models/file";
import { Template } from "@langgraph/models/template";
import { fileSpecRegistry } from "@models/registry/fileSpecificationRegistry";
import { FileTypeEnum, PageTypeEnum, LayoutTypeEnum } from "@models/enums";
import { createInstructionList } from "@prompts/helpers/formatters";
import { CodeTaskType } from "@models/codeTask";
import { PromptTemplate } from "@langchain/core/prompts";
import { formatFiles } from "@prompts/helpers";
import { Project } from "@langgraph/models/project";

export const baseCreatePrompt = PromptTemplate.fromTemplate(`
    <role>
        {role}
    </role>

    <task>
        {task}
    </task>

    <section-plan>
        {sectionPlan}
    </section-plan>

    <instructions>
        {instructions}
        {additionalInstructions}
    </instructions>

    <important>
        {important}
    </important>

    <files>
        {files}
    </files>
`);

const role = `You are the Page Assembly Agent. Your task is to take a detailed plan for a React page, import the sections, and assemble the page in the correct order using ShadCN and TailwindCSS.
The goal is to create beautiful, responsive, and production-ready code based *strictly* on the provided plan and design guidelines.`;
const task = `Generate the React/TSX code for the page detailed below.`;
const defaultInstructions = [
    `**Maintain Existing Code:** You may receive an existing page file to modify. If so, insert any new sections, and output the FULL page code.`,
    `**Shadcn UI:** Utilize Shadcn UI components. They are pre-installed. Some components may have been suggested in the <suggested-components> list.`,
    `**Imports:** Include all necessary imports for React, Shadcn components, Lucide icons (if used), etc.`,
    `**Dependencies:** List any *new* npm package dependencies required beyond the standard stack (React, Next.js, Tailwind, Shadcn UI, Lucide-react). Usually, this should be empty.`,
    `**Code Quality:** Generate clean, readable, well-formatted, and strongly-typed code. Include comments only where necessary for complex logic.`,
    `**Strict Adherence:** Follow the plan precisely. Do NOT add features, content, or styling not specified in the plan or guidelines. Do NOT invent image URLs or icons. Use only provided Lucide icons or Unsplash URLs.`,
    `**Output Format:** Your final output MUST strictly adhere to the required JSON schema structure. Ensure the 'code' field contains ONLY the valid TSX code as a single string.`
]

const createPageInstructions = createInstructionList([
    `**Analyze Input:** Carefully review the provided <page-plan> (in JSON format), <brand-guidelines>, and <design-guidelines>.`,
    `**Frameworks:** Use React, TypeScript, Shadcn UI, and Tailwind CSS ONLY.`,
    `**Content Integration:** Import the sections from the <section-plan> and assemble them in the correct order.`,
    `**Styling:** Implement <visualStyleNotes> from the plan using Tailwind CSS classes. Adhere strictly to the <theme> provided in the <brand-guidelines>.`,
    `**Layout:** Implement the <layoutDescription> and respect the <layoutEmphasis>.`,
    `**Responsiveness:** Implement <responsivenessNotes>. Ensure the component looks good and functions correctly on various screen sizes.`
].concat(defaultInstructions));

const updatePageInstructions = createInstructionList([
    `**Analyze Input:** Carefully review the <new-sections>, and ensure they are properly imported and added to the page`,
   `**PRESERVE EXISTING FILE**: The existing file content is provided for you below as <file>. PLEASE OUTPUT THE ENTIRE FILE, INCLUDING THE NEWLY ADDED SECTION AND THE EXISTING CONTENT as <code> DO NOT OUTPUT placeholders or comments, just the final code`,
].concat(defaultInstructions));

export const assemblePagePrompt = async(state: GraphState): Promise<string> => {
    const layouts = fileSpecRegistry.getLayout();;
    const layoutElements = layouts.map((section) => {
        return {
            ...section,
            componentId: section?.subtype
        }
    });
    const nav = layoutElements.filter(l => l.subtype === LayoutTypeEnum.Nav)
    const footer = layoutElements.filter(l => l.subtype === LayoutTypeEnum.Footer)
    const pageElements = [...nav, ...(state.app.page?.plan.sections || []), ...footer];

    let instructions;
    let sectionPlan;
    let additionalInstructions = "";
    let files;
    if (state.task.type === CodeTaskType.UPDATE) {
        instructions = updatePageInstructions;
        sectionPlan = state.task.plan?.instruction;
        const project = Project.create(state.app?.project ?? {} as ProjectData);
        files = await project.getEditableFiles(state.jwt);
    } else {
        const template = await Template.getTemplate('default');
        instructions = createPageInstructions;
        const expectedImports = pageElements.map(s => `import { ${s.componentId} } from '@/components/${s.componentId}.tsx';`).flat() || [];
        sectionPlan = pageElements.map(s => s.componentId).flat() || [];
        additionalInstructions += `Expected imports:\n${expectedImports.join('\n')}`;
        files = template.files;
    }
    const fileSpecModel = fileSpecRegistry.getByType(FileTypeEnum.Page, PageTypeEnum.IndexPage);
    if (!fileSpecModel) {
        throw new Error("Cannot find file specification for page: IndexPage.");
    }
    const contentfulFiles = [fileSpecModel.canonicalPath];
    const filteredFiles: FileMap = Object.fromEntries(Object.entries(files).filter(([path]) => contentfulFiles.includes(path)));

    const values = {
        role,
        task,
        sectionPlan,
        instructions,
        additionalInstructions,
        important: "Ensure all components are correctly imported and assembled.",
        files: formatFiles(filteredFiles, contentfulFiles),
    }
    return await baseCreatePrompt.format(values);
}
    