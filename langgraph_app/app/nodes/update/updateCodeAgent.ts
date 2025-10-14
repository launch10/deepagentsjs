// import { type WebsiteBuilderGraphState } from "@shared/state/graph";
// import { codeTaskResultSchema, type CodeTaskResult } from "@models/codeTask";
// import { formatFiles } from "@prompts/helpers";
// import { Project } from "@langgraph/models/project";
// import { type FileMap } from "@models/file";
// import { createCodeAgent } from "~/lib/server/langgraph/nodes/helpers/codeAgent";
// import { type ProjectData } from "@models/project";
// import { PromptTemplate } from "@langchain/core/prompts";
// import { StructuredOutputParser } from "@langchain/core/output_parsers";
// import { highLevelPrinciples, lowLevelPrinciples } from "~/lib/server/langgraph/prompts/helpers/context/principles";
// import { completeCodeTask } from "~/lib/server/langgraph/nodes/actions/codeTasks";
// import { assemblePageNode } from "@nodes/createPage/assemblePage";
// import { baseNode } from "@nodes/core/templates/base";
// import { FileTypeEnum } from "@models/enums";
// import { type CompletedCodeTask } from "@models/codeTask";

// const systemPrompt = PromptTemplate.fromTemplate(`You are an expert AI software engineer. Another agent has tasked you with executing code modifications based on the user's request. Your goal is to plan and generate the necessary code modifications based on the user's request.
//     You should:
//     1.  Understand the provided instruction (based on the user's request) <instruction>
//     2.  Understand the user's request <userRequest>
//     3.  Understand the existing code <file>
//     4.  Plan the necessary changes based on the instruction and the existing code.
//     5.  Output the FULL content of the file after the changes have been applied. <code>
//     6.  Output a list of any NEWLY installed npm dependencies <dependencies>
//     7.  Output a summary of the changes made <summary>
//     8.  **IMPORTANT**: Your final output MUST be structured according to the required format. For each file you intend to modify, provide its full path and the **complete, final code** that should be in that file after your changes. Do not provide diffs or partial snippets.
//     9.  When you have decided on all the necessary modifications and generated the final code for all affected files, provide your response in the required structured format. Do not call any more tools after deciding you are finished.

//     <instruction>
//        {instruction}
//     </instruction>

//     <userRequest>
//       {userRequest}
//     </userRequest>

//     <current-error>
//       {currentError}
//     </current-error>

//     {formattedFile}

//     <format-instructions>
//         {formatInstructions}
//     </format-instructions>

//     <design-principles>
//       {highLevelPrinciples}
//       {lowLevelPrinciples}
//     </design-principles>
// `);

// const getPrompt = async(state: GraphState): Promise<string> => {
//     const parser = StructuredOutputParser.fromZodSchema(codeTaskResultSchema);
//     const formatInstructions = parser.getFormatInstructions();
    
//     const filePath = state.task.filePath;
//     const project = Project.create(state.app?.project ?? {} as ProjectData);
//     const files: FileMap = await project.getFiles([filePath]);
//     const formattedFile = await formatFiles(files, [filePath]);

//     return systemPrompt.format({
//         instruction: state.task?.plan?.instruction ?? '',
//         userRequest: state.userRequest.content,
//         formattedFile,
//         formatInstructions,
//         currentError: state.currentError,
//         highLevelPrinciples,
//         lowLevelPrinciples
//     });
// }

// const updateCode = async(state: GraphState, config: LangGraphRunnableConfig): Promise<Partial<GraphState>> => {
//   if (state.task.fileSpec.filetype === FileTypeEnum.Page) {
//     return await assemblePageNode(state, config);
//   } else {
//     const callAgent = await createCodeAgent({ getPrompt })
//     const agentResult = await callAgent(state, config);
//     const result = agentResult.structuredResponse as CodeTaskResult;
//     const task = completeCodeTask(state, result);
//     return {
//       app: {
//           codeTasks: {
//               completedTasks: [task as CompletedCodeTask],
//           }
//       }
//     }
//   }
// }

// export const updateCodeAgent = baseNode({
//   nodeName: "updateCodeAgent",
//   nodeFn: updateCode
// });