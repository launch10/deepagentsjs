import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { GraphState } from "@shared/state/graph";
import type { ProjectPlan } from "@models/project/projectPlan";
import type { PageData } from "@models/page";
import { type ProjectData, ProjectMode } from "@models/project";
import { type CodeTask, TaskStatus, CodeTaskType } from "@models/codeTask";
import { SectionTypeEnum } from "@models/enums";

// Determine the root directory relative to this file
// Adjust the number of '../' based on the actual file location relative to the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assuming the service file is at app/lib/server/services/mockDataService.ts
// And mocks are at /mocks/
const projectRoot = path.resolve(__dirname, "../../../../../"); 
const mocksDir = path.join(projectRoot, "mocks");

export const loadMockGraphState = (initialState: GraphState): GraphState => {
    const state = { ...initialState }; 

    const projectPlanPath = path.join(mocksDir, "projectPlan.json");
    const pagePath = path.join(mocksDir, "page.json");

    if (!fs.existsSync(projectPlanPath)) {
        throw new Error(`Mock file not found: ${projectPlanPath}`);
    }
    if (!fs.existsSync(pagePath)) {
        throw new Error(`Mock file not found: ${pagePath}`);
    }

    const projectPlan: ProjectPlan = JSON.parse(fs.readFileSync(projectPlanPath, "utf-8"));
    const page: PageData = JSON.parse(fs.readFileSync(pagePath, "utf-8"));

    const projectData: ProjectData = {
        projectName: "ai-newsletter", // Example project name
        projectMode: ProjectMode.Guided,
        projectPlan,
        pages: [page],
        accountId: undefined,
        rootPath: projectRoot
    };

    const sectionOverview = projectData.pages?.[0]?.plan?.sections?.[0];
    if (!sectionOverview) {
        throw new Error("Could not find section overview in mock data.");
    }

    const codeTask: CodeTask = {
        id: "mock-task-12345",
        type: CodeTaskType.CREATE_SECTION,
        status: TaskStatus.IN_PROGRESS,
        instruction: "Create the Hero section",
        section: {
            id: sectionOverview.id,
            filePath: `src/components/${sectionOverview.id}.tsx`,
            sectionType: sectionOverview.sectionType,
            contentPlan: {
                overview: sectionOverview
            }
        },
    };

    state.task = codeTask;
    if (!state.app) { 
        state.app = { 
            project: undefined,
            page: undefined,
            files: {},
            codeTasks: {
                queue: [],
                completedTasks: [],
                taskHistory: undefined
            },
            error: undefined,
            success: true 
        };
    }
    state.app.project = projectData;
    state.app.page = page;

    console.log("Loaded mock graph state.");
    return state;
};
