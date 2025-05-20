import { type Project } from "@models/project";
import { type ProjectPlan } from "@models/project/projectPlan";
import { type GraphState } from "@shared/state/graph";

// Helper to format brand info safely
export const formatBrandInfo = (state: GraphState) => {
    const project = state.app.project as Project;
    const projectPlan = project.projectPlan as ProjectPlan;
    const contentStrategy = projectPlan.contentStrategy;

    let info = "";
    if (projectPlan?.projectName) info += `- Project Name: ${projectPlan.projectName}\n`;
    if (contentStrategy?.overallTone) info += `- Overall Tone: ${contentStrategy.overallTone}\n`;
    if (contentStrategy?.pageMood) info += `- Page Mood: ${contentStrategy.pageMood}\n`;
    if (contentStrategy?.visualEvocation) info += `- Visual Evocation: ${contentStrategy.visualEvocation}\n`;
    info += "";
    return info;
}