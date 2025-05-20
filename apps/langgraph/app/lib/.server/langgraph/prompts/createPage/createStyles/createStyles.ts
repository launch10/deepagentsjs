import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { codeTaskResultSchema } from "@models/codeTask";
import { type GraphState } from "@shared/state/graph";
import { type FileMap } from "@models/file";
import { formatFiles } from "@prompts/helpers";
import { Template } from "@langgraph/models/template";
import { fileSpecRegistry } from "@models/registry/fileSpecificationRegistry";
import { StyleTypeEnum } from "@models/enums";
import stringify from "fast-json-stable-stringify";

export const createStylesPrompt = async (state: GraphState): Promise<string> => {
    const parser = StructuredOutputParser.fromZodSchema(codeTaskResultSchema);
    const formatInstructions = parser.getFormatInstructions();

    const { task } = state;
    const { filePath } = task;
    const { theme } = state.app.project?.projectPlan ?? {};
    const template = await Template.getTemplate('default');
    const files = template.files;
    const styleFiles = fileSpecRegistry.getAllStyles();
    const desiredFiles = [StyleTypeEnum.IndexCss, StyleTypeEnum.TailwindConfig].map(type => styleFiles.find(file => file.subtype === type)?.canonicalPath ?? '').filter((path) => path !== filePath);
    const referenceFiles: FileMap = desiredFiles.reduce((acc, path) => {
        if (files[path]) {
            acc[path] = files[path];
        }
        return acc;
    }, {} as FileMap);

    let indexCssContent = '';
    if (task.filePath === "tailwind.config.ts") {
      indexCssContent = state.app.codeTasks?.completedTasks.find(task => task.filePath === "src/index.css")?.results?.code ?? '';
      // Set the generated index.css content as a reference file, not the default
      referenceFiles['src/index.css'] = { path: 'src/index.css', content: indexCssContent };
    }


    const fileContent = formatFiles(files, [filePath as string]);
    const generationPrompt = task.fileSpec?.generationPrompt;
    let formattedGenerationPrompt = '';
    if (generationPrompt) {
        formattedGenerationPrompt = generationPrompt(state);
    }

    return `
      <task>
        ${task.instruction}
      </task>

      <role>
        You are an expert software development developer. 
        Your goal is to analyze a <task>, and the original <file-content>, and determine which changes need to be made, then to generate the updated code.
        These changes will center around creating the styles (look and feel) of the entire codebase, by updating the ${filePath} file.
        You will also have the following context:
          1. <reference-files> - Files which are related to the file you are editing
          2. <user-request> - The user's original request
      </role>

      <instructions>
        1. Think carefully about the instructions.
        2. Plan the changes needed to the file.
        3. You have been given access to the <theme>, which contains the color theme for the project. Aim to replicate this perfectly, by using the same colors and names (e.g. primary, secondary, etc.)
        4. Generate the updated code.
        5. Output the FULLY updated code, do not output any partial code or ellipses. 
      </instructions>

      <theme>
        ${stringify(theme)}
      </theme>

      <file-to-edit>
        ${filePath}
      </file-to-edit>

      <file-specific-instructions>
        ${formattedGenerationPrompt}
      </file-specific-instructions>

      <file-content>
        ${fileContent}
      </file-content>

      <reference-files>
        ${formatFiles(referenceFiles, Object.keys(referenceFiles), false)}
      </reference-files>

      <user-request>
        ${state.userRequest.content as string}
      </user-request>

      <output>
        ${formatInstructions}
      </output>

      <task>
        ${task.instruction}
      </task>
    `;
}