import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getLlm, LLMSkill } from "@langgraph/llm";
import { initializeTools as initializeFileSearch } from "@langgraph/tools/searchFiles";
import { initializeTools as initializeContentStrategy } from "@langgraph/tools/getContentStrategy";
import { initializeTools as initializeSearchIcons } from "@langgraph/tools/searchIcons";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import type { GraphState } from "@shared/state/graph";
import { CodeTaskType, 
         TaskStatus,
         codeTaskPlansSchema,
         type CodeTask, 
         type CodeTaskPlan 
        } from "@models/codeTask";
import { baseNode } from "@nodes/core/templates/base";
import { HumanMessage } from "@langchain/core/messages";
import { formatFiles } from "@prompts/helpers";
import { type ProjectData } from "@models/project";
import { Project } from "@langgraph/models/project";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { fileSpecRegistry } from "@models/registry/fileSpecificationRegistry";
import { FileTypeEnum } from "@models/enums";
import { type Section } from "@models/section";
import { type FileSpecification } from "@models/fileSpecification";
import { highLevelPrinciples } from "@prompts/helpers";
import { whenToChooseEachSection } from "@prompts/helpers";
import { type FileMap } from "@models/file";

const identifyFilesNamedInError = (error: string, fileMap: FileMap): string[] => {
  const fileNames = Object.keys(fileMap);
  return fileNames.filter(name => error.includes(name));
};

const buildPrompt = async(state: GraphState): Promise<string> => {
  const project = Project.create(state.app?.project ?? {} as ProjectData);
  const editableFiles = await project.getEditableFiles();
  let files;

  const parser = StructuredOutputParser.fromZodSchema(codeTaskPlansSchema);
  const formatInstructions = parser.getFormatInstructions();
  if (state.currentError) {
    const filesNamedInError = identifyFilesNamedInError(state.currentError, editableFiles);
    files = Object.fromEntries(filesNamedInError.map((fileName) => [fileName, editableFiles[fileName]]));
  } else {
    files = editableFiles;
  }
  const formattedFiles = formatFiles(files);
  const systemPrompt = `
    <role>
      You are an expert AI software engineer. Your goal is to PLAN the necessary modifications based on the user's request. A SEPARATE agent will be responsible for generating the actual code changes.
    </role>

    <design-principles>
      ${highLevelPrinciples}
    </design-principles>

    <request-types>
    - UPDATE: If we need to update an existing section or file (e.g. index.css, tailwind.config.ts), use this type. This can be a bug fix, style change, content update, etc.
    - CREATE_SECTION: If we need to create a new page section on an existing page, use this type.
    - CREATE_PAGE: If we need to create a new page, use this type.
    </request-types>

    <important>
      It is PARAMOUNT that you get each request type correct. For an UPDATE, the file must be one of the provided <file>
      If it is a CREATE_SECTION, the file must NOT be one of the provided <file>, and we will have to add the new component to the page.
      If it is a CREATE_PAGE, the file must NOT be one of the provided <file>, and we will have to add the new page to the project.
    </important>
    
    <instructions>
    1.  Understand the user's request.
    2.  Use the 'fileSearch' tool to read the full text of all existing files. This tool will return the **full content** of the files found.
    3.  Analyze the content provided by the 'fileSearch' tool.
    4.  Plan which files need to be modified and/or created, and the changes required for each.
    5.  If you need to generate a new section, use the 'getContentStrategy' tool to get the content strategy for the project. 
    6.  Analyze the content strategy provided by the 'getContentStrategy' tool, and generate the new copy in the <instruction> for the CREATE_SECTION task.
    7.  If you generate a new section, be sure to also generate an UPDATE task for the page that will contain the new section, including an instruction about how to name the import, and where to add the new section to the page.
    8.  If the user requests global style changes, they should be made to index.css or tailwind.config.ts. If a user wants to update the theme or colors, these should be the first files you search for.
    9.  **IMPORTANT**: Your final output MUST be structured according to the required format. For each file you intend to modify, provide its full path and the **complete, instructions required to modify it**.
    10.  **IMPORTANT**: Each file will be processed by a SEPARATE worker. They WILL NOT have access to other workers' changes or context. Ensure EACH agent has ALL the information it needs to complete its task in the INSTRUCTION you provide.
    11.  When you have decided on all the necessary modifications and generated the instructions for all affected files, provide your response in the required structured format. Do not call any more tools after deciding you are finished.
    </instructions>

    <when-to-choose-section>
      ${whenToChooseEachSection}
    </when-to-choose-section>

    <current-error>
      ${state.currentError}
    </current-error>

    <files>
      ${formattedFiles}
    </files>

    <structured-output>
      ${formatInstructions}
    </structured-output>
    `;
  return systemPrompt;
}

// If a CREATE_SECTION task is generated, ensure an UPDATE_PAGE task is generated for the page it belongs to
const ensurePageTasks = (codeTasks: CodeTask[]) => {
  const createPageTasks = codeTasks.filter((task) => task.type === CodeTaskType.UPDATE && task.fileSpec?.filetype === FileTypeEnum.Page);
  const sectionsByPage = codeTasks.filter((task) => task.type === CodeTaskType.CREATE_SECTION).reduce(
    (acc, task) => {
      acc[task.plan?.sectionOverview?.page] ||= [];
      acc[task.plan?.sectionOverview?.page].push(task);
      return acc;
    }, {} as Record<string, CodeTask[]>);
  let additionalTasks: CodeTask[] = [];

  Object.entries(sectionsByPage).forEach(([page, tasks]) => {
    const pageTask = createPageTasks.find((pageTask) => pageTask.fileSpec?.subtype === page); 
    if (!pageTask) {
      let pageFileSpec = fileSpecRegistry.getByType(FileTypeEnum.Page, page);
      additionalTasks.push({
        type: CodeTaskType.UPDATE,
        status: TaskStatus.PENDING,
        filePath: pageFileSpec?.canonicalPath,
        plan: {
          filePath: pageFileSpec?.canonicalPath,
          instruction: `
            Update the existing ${page} to import the newly created sections, in order to fulfill the user's request. 
            <important>
              You do NOT need to CREATE the sections requested by the user. They have already been created for you.
              Your only job is to import the sections and place them in the most appropriate location on the page.
              DO NOT REMOVE any existing code. ONLY ADD the new sections. OUTPUT the COMPLETE code for the page, including all existing code.
            </important>
            <new-sections>
            ${tasks.map((task) => {
              return `import { ${task.plan?.sectionOverview.componentId} } from "@components/${task.plan?.filePath}" // Place this section in the most appropriate location on the page`
            }).join(", ")}
            </new-sections>
          `
        },
        fileSpec: pageFileSpec,
      })
    }
  })

  return [...codeTasks, ...additionalTasks];
}

// TODO: ensure all CREATE_PAGE have UPDATE_SECTION with type nav in queue afterwards (e.g. add the page to the nav)
//
const makeBuildTasksAgent = async(state: GraphState, config: LangGraphRunnableConfig): Promise<Partial<GraphState>> => {
  const llm = getLlm(LLMSkill.Planning);
  const { searchFiles } = await initializeFileSearch(state);
  const { getContentStrategy } = await initializeContentStrategy(state);
  const { searchIcons } = await initializeSearchIcons(state);
  const tools = [searchFiles, getContentStrategy, searchIcons];
  const systemPrompt = await buildPrompt(state);

  const agent = createReactAgent({
    llm,
    tools,
    prompt: systemPrompt,
    responseFormat: codeTaskPlansSchema,
  });
  const agentState = {
    messages: [
      ...(state.messages ?? []),
      new HumanMessage(state.userRequest.content) // This gets improperly serialized between graph passes
    ]
  }
  const finalState = await agent.invoke(agentState, config);
  const taskResults: CodeTaskPlan[] | undefined = finalState.structuredResponse.tasks;

  if (!taskResults) {
    console.error("Agent did not return the expected structured response format.");
    return {
      currentError: "Agent failed to generate code modifications.",
      app: {
        ...state.app,
        codeTasks: {
           ...(state.app?.codeTasks ?? {}),
        }
      }
    }
  }

  let codeTasks: CodeTask = taskResults.map((taskResult) => {
    let section: Section | undefined;
    let fileSpec: FileSpecification | undefined;
    let filePath = taskResult.filePath;
    fileSpec = fileSpecRegistry.getByPath(taskResult.filePath);

    if (taskResult.sectionOverview !== undefined) {
      fileSpec = fileSpecRegistry.getByType(FileTypeEnum.Section, taskResult.sectionOverview.sectionType);
      if (!fileSpec) {
        throw new Error(`File specification not found for section: ${taskResult.sectionOverview.sectionType}`);
      }
      filePath = taskResult.filePath;
      section = {
        filePath: filePath,
        sectionType: taskResult.sectionOverview.sectionType,
        contentPlan: {
          overview: taskResult.sectionOverview,
        }
      }
    }

    return {
        status: TaskStatus.PENDING,
        type: taskResult.type,
        plan: taskResult,
        filePath: filePath,
        section: section,
        fileSpec: fileSpec,
    }
  });

  codeTasks = ensurePageTasks(codeTasks);

  return {
    app: {
      codeTasks: {
        ...state.app.codeTasks,
        queue: codeTasks
      }
    }
  }
}

export const buildTasksAgent = baseNode({
  nodeName: "buildTasksAgent",
  nodeFn: makeBuildTasksAgent
});