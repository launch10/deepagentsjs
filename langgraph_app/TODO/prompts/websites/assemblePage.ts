import { 
  structuredOutputPrompt,
  renderPrompt,
  type PromptMetadata,
  toXML,
  toPipe,
  filesPrompt, 
} from "@prompts";
import { 
  type FileMap, 
  type PageType, 
  type WebsiteType,
  CodeTask,
  PageTypeEnum,
  ActionEnum, 
} from "@types";
import { WebsiteFileModel, ComponentModel, ComponentOverviewModel } from "@models";
import { fileSpecRegistry } from "@core";
import { filesToFileMap } from "@utils";
export interface AssemblePageProps {
  website: WebsiteType;
  page: PageType;
}

export const assemblePagePrompt = async({ page, website }: AssemblePageProps): Promise<string> => {
  if (!page) {
    throw new Error('page is required');
  }

  const components = await ComponentModel.where({ pageId: page.id, });
  if (!components) {
    throw new Error('components is required');
  }  

  const componentOverviews = await ComponentOverviewModel.where({ id: components.map((c) => c.componentOverviewId) });
  const fileList = await WebsiteFileModel.where({ id: components.map((c) => c.websiteFileId) });

  if (fileList.length === 0) {
    throw new Error('No files found for page');
  }

  const files = filesToFileMap(fileList); 
  const taskAction = ActionEnum.UPDATE;

  // Specifically inject the full text of the IndexPage
  const indexPageSpec = fileSpecRegistry.get(PageTypeEnum.IndexPage);
  const includeFullTextFilePaths = [indexPageSpec!.canonicalPath];
  const promptFiles: FileMap = Object.keys(files)
    .sort()
    .filter((path) => includeFullTextFilePaths.includes(path))
    .reduce((acc, path) => {
      acc[path] = files[path];
      return acc;
    }, {} as FileMap);
  const schema = CodeTask.resultSchema;

  const [filesStr, formatInstructionsStr] = await Promise.all([
    filesPrompt({ files: promptFiles }),
    structuredOutputPrompt({ schema }),
  ])
  const sortedOverviews = componentOverviews.sort((a, b) => a.sortOrder -
  b.sortOrder);
  const sortedComponents = components.sort((a, b) => {
    const overviewA = sortedOverviews.find(o => o.id === a.componentOverviewId);
    const overviewB = sortedOverviews.find(o => o.id === b.componentOverviewId);
    return (overviewA?.sortOrder ?? 0) - (overviewB?.sortOrder ?? 0);
  });
  const expectedComponentName = "IndexPage";

  return renderPrompt(`
      <role>
        You are the Page Assembly Agent. Your task is to take a detailed plan for 
        a React page, import the sections, and assemble the page in the correct 
        order using ShadCN and TailwindCSS.
        The goal is to create beautiful, responsive, and production-ready code 
        based *strictly* on the provided plan and design guidelines.
      </role>

      <task>
        Generate the React/TSX code for the page detailed below.
      </task>

      ${toPipe(
        sortedComponents.map((c) => {
          return { 'expected-components':  c.name! }
        })
      )}

      <instructions>
        1. **Maintain Existing Code:** You may receive an existing page file to modify. If so, insert any new sections, and output the FULL page code.
        2. **Shadcn UI:** Utilize Shadcn UI components. They are pre-installed. Some components may have been suggested in the \`suggested-components\` list.
        3. **Imports:** Include all necessary imports for React, Shadcn components, Lucide icons (if used), etc. 
        4. **Dependencies:** List any *new* npm package dependencies required beyond the standard stack (React, Next.js, Tailwind, Shadcn UI, Lucide-react). Usually, this should be empty.
        5. **Code Quality:** Generate clean, readable, well-formatted, and strongly-typed code. Include comments only where necessary for complex logic.
        6. **Strict Adherence:** Follow the plan precisely. Do NOT add features, content, or styling not specified in the plan or guidelines. Do NOT invent image URLs or icons. Use only provided Lucide icons or Unsplash URLs.
        7. **Output Format:** Your final output MUST strictly adhere to the required JSON schema structure. Ensure the 'code' field contains ONLY the valid TSX code as a single string.
        8. **Analyze Input:** Carefully review the provided \`page-plan\` (in JSON format), \`brand-guidelines\`, and \`design-guidelines\`.
        9. **Frameworks:** Use React, TypeScript, Shadcn UI, and Tailwind CSS ONLY.
        10. **Content Integration:** Import the sections from the \`section-plan\` and assemble them in the correct order.
        11. **Styling:** Implement \`visualStyleNotes\` from the plan using Tailwind CSS classes. Adhere strictly to the \`theme\` provided in the \`brand-guidelines\`.
        12. **Layout:** Implement the \`layoutDescription\` and respect the \`layoutEmphasis\`.
        13. **Responsiveness:** Implement \`responsivenessNotes\`. Ensure the component looks good and functions correctly on various screen sizes.
        ${
          taskAction === ActionEnum.UPDATE && (
            `14. **Analyze Input:** Carefully review the \`new-sections\`, and ensure they are properly imported and added to the page
             15. **PRESERVE EXISTING FILE**: The existing file content is provided for you below as \`file\`. PLEASE OUTPUT THE ENTIRE FILE, INCLUDING THE NEWLY ADDED SECTION AND THE EXISTING CONTENT as \`code\` DO NOT OUTPUT placeholders or comments, just the final code`
          )
        }
        ${
            expectedComponentName && (
                    `16. **Component Name:** Create a component named: ${expectedComponentName}. Give the component an ID of ${expectedComponentName}, so that it can be used as an anchor for links.
                    17. **Use Named Export:** Export the component as ${expectedComponentName}. DO NOT USE default export.
                `
            )
        }
      </instructions>

      <important>
        1. Ensure all components are correctly imported and assembled.
        2. Ensure the components are used in the order specified in the page plan.
        3. Imports will be provided in the \`import-statements\` tag — they will never be default imports (always named imports)
      </important>

      ${toPipe(
        sortedComponents.map((c) => {
          return { 'import-statements':  `import { ${c.name} } from "@/${c.path}"` }
        })
      )}

      ${filesStr}

      ${formatInstructionsStr}
  `);
}

assemblePagePrompt.promptMetadata = {
    name: 'Assemble Page',
    category: 'Code Generation',
    description: 'Assembles the page based on the provided plan',
    examples: []
} as PromptMetadata;