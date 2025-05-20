import { type GraphState } from "@shared/state/graph";
import { baseNode } from "@nodes/core/templates/base";
import { ProjectMode } from "@models/project"; 
import type { PageData } from "@models/page"; 
import { createProject, updateProject } from "@services/saveProject"; 

const save = async (state: GraphState): Promise<Partial<GraphState>> => {
    const { project, page } = state.app;

    if (!project) {
        throw new Error("Project is missing from state.");
    }
    
    project.projectMode ||= ProjectMode.Magic;
    project.pages ||= [];

    if (page) { 
        const pageIndex = project.pages.findIndex(p => p.filePath === page.filePath);

        if (pageIndex !== -1) {
            project.pages[pageIndex] = { ...project.pages[pageIndex], ...page };
        } else {
            project.pages.push(page as PageData);
        }
    }

    if (state.isFirstMessage) {
        await createProject(state);
    } else {
        await updateProject(state);
    }
    
    return {
        app: {
            ...state.app,
            project, 
            codeTasks: {
                ...state.app.codeTasks,
                queue: [],
                completedTasks: [],
            }
        }
    }
}

export const saveNode = baseNode({
    nodeName: "save",
    nodeFn: save
});