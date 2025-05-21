import { baseNode } from "@nodes/core/templates/base";
import { type GraphState } from "@shared/state/graph";
import { type CodeTask, CodeTaskType, TaskStatus } from "@models/codeTask";
import { v4 as uuidv4 } from "uuid";
import { fileSpecRegistry } from "@models/registry/fileSpecificationRegistry";
import { FileTypeEnum } from "@models/enums";
import { type PageData } from "@models/page";
import { type FileSpecification } from "@models/fileSpecification";

// after building the node, ensure we queue a task to add the section to the page
// WHY: applyUpdates checks for completed tasks, so this ensures the page file is added to the queue
//
export async function queuePage(state: GraphState): Promise<Partial<GraphState>> {
  const { task } = state;
  const { page } = state.app
  const pageData = page as PageData;

  const fileSpec = fileSpecRegistry.getByType(FileTypeEnum.Page, pageData.subtype) as FileSpecification;

  // optionally add additionalFileContext to include the full content of the file in the prompt
  // additionalFileContext: task.additionalFileContext
  const pageTask: CodeTask = {
    id: uuidv4(),
    type: CodeTaskType.CREATE_PAGE,
    status: TaskStatus.PENDING,
    filePath: fileSpec.canonicalPath,
    fileSpec: fileSpec,
    section: task.section,
    instruction: "Add the section to the page",
  } as CodeTask;
  return { 
    task: pageTask, 
  }
}

export const queuePageNode = baseNode({
  nodeName: "queuePage",
  nodeFn: queuePage
});
