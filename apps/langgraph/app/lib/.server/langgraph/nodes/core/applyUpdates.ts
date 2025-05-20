import { CodeManager } from "@services/codeManager"; 
import type { GraphState } from "@shared/state/graph";
import { type FileData, type FileMap } from "@models/file";
import { updateTaskHistory } from "@tools/taskHistory";
import { isFirstMessage } from "@state/helpers";
import { Template } from "@langgraph/models/template";
import { baseNode } from "@nodes/core/templates/base";
import { fileSpecRegistry } from "@shared/models/registry/fileSpecificationRegistry";
import { fileSpecification as FileSpecTable } from "@db/schema";
import { eq } from "drizzle-orm";
import { db } from "@db";
import { createProject, updateProject } from "@services/saveProject";

// Node to apply the accumulated code updates back to the project files
const applyUpdates = async(state: GraphState): Promise<Partial<GraphState>> => {
    console.log("--- Running applyUpdatesNode ---");

    const projectName = state.app.project?.projectName;
    const completedTasks = state.app.codeTasks?.completedTasks;

    if (!projectName) {
        return { app: { ...state.app, error: "projectName is missing in state" } };
    }
    if (!completedTasks || completedTasks.length === 0) {
        console.warn("No completed tasks found in state. Skipping apply step.");
        // Consider if this should be an error or just a no-op
        return { app: { ...state.app, error: "No completed tasks found in state" } }; 
    }

    const codeManager = new CodeManager(projectName);
    
    // Format the results for writeFiles
    let filesToWrite: FileMap = {};
    const dependenciesToInstall: string[] = [];

    // If this is the first message, we need to add the default template files
    // Which may have been overridden by the CodeTasks
    //
    // Or possible we could just update the state.files the whole time?
    if (isFirstMessage(state)) {
        const template = await Template.getTemplate("default");
        filesToWrite = template.files;
    }

    let error = undefined;
    const allFileSpecs = await db.select({
        id: FileSpecTable.id,
        subtype: FileSpecTable.subtype
    }).from(FileSpecTable);

    const fileSpecsMap: Record<string, number | undefined> = allFileSpecs.reduce((acc, spec) => {
        if (spec.subtype) { // Ensure subtype is not null or undefined
            acc[spec.subtype] = spec.id;
        }
        return acc;
    }, {} as Record<string, number | undefined>);

    for (const task of completedTasks) {
        // Check for success and that modifiedContent is available
        if (!task.filePath) {
            error = "Task is missing filePath";
            break;
        }
        if (task.success && task.results?.code) {
            filesToWrite[task.filePath] = {
                path: task.filePath,
                content: task.results.code,
                fileSpecificationId: task.fileSpec?.subtype ? fileSpecsMap[task.fileSpec.subtype] : undefined,
            } as FileData;
            if (task.results?.dependencies) {
                dependenciesToInstall.push(...task.results.dependencies);
            }
        } else {
            console.warn(`Skipping failed or incomplete update for file: ${task.filePath}`);
        }
    }

    if (error) {
        return { app: { ...state.app, error } };
    }

    if (Object.keys(filesToWrite).length === 0) {
        console.warn("No successful updates to write.");
        return { app: { ...state.app, error: "No successful updates to write." } };
    }

    await codeManager.writeFiles(filesToWrite);
    if (dependenciesToInstall.length > 0) {
        await codeManager.installDependencies(dependenciesToInstall);
    }
    console.log("File updates applied successfully.");

    return { app: { 
        ...state.app, 
        files: filesToWrite,
        success: true,
        codeTasks: {
            taskHistory: updateTaskHistory(state)
        }
    } };
}

export const applyUpdatesNode = baseNode({
    nodeName: "applyUpdatesNode",
    nodeFn: applyUpdates
});
