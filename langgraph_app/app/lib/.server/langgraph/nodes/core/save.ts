import { type GraphState } from "@shared/state/graph";
import { baseNode } from "@nodes/core/templates/base";
import { ProjectMode } from "@models/project"; 
import type { PageData } from "@models/page"; 
import { createProject, updateProject } from "@services/saveProject"; 
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const save = async (state: GraphState, config: LangGraphRunnableConfig): Promise<Partial<GraphState>> => {
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
        await createProject(state, config);
    } else {
        await updateProject(state, config);
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
    nodeFn: save,
    buildTask: (state: GraphState, config: LangGraphRunnableConfig) => {
        return {
            title: "Saving changes",
        };
    }
});

const saveInitial = async (state: GraphState, config: LangGraphRunnableConfig): Promise<Partial<GraphState>> => {
    const apiUrl = process.env.RAILS_API_URL;

    if (apiUrl) {
        fetch(`${apiUrl}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${state.jwt}`,
            },
            body: JSON.stringify(
                {
                    name: state.projectName,
                    thread_id: config.configurable?.thread_id,
                }
            )
        }).catch(error => {
            console.error('Failed to send initial project data to Rails API:', error);
        });
    } else {
        console.warn('RAILS_API_URL is not defined in environment variables. Skipping initial project creation POST request.');
    }

    return {};
}

export const saveInitialNode = baseNode({
    nodeName: "saveInitial",
    nodeFn: saveInitial,
});
