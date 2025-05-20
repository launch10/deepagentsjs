import { type GraphState } from "@shared/state/graph";

export const loadShared = async (state: GraphState): Promise<Partial<GraphState>> => {
    return {
        ...state,
        app: {
            ...state.app,
            error: undefined,
            codeTasks: {
                ...state.app.codeTasks,
                queue: [],
                completedTasks: []
            },
            project: {
                ...state.app.project,
                projectName: state.projectName
            }
        }
    }
}