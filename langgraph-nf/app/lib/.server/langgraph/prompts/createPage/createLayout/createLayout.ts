import { type GraphState } from "@shared/state/graph";
import { type FileMap } from "@models/file";
import type { FileSpecification } from "@models/fileSpecification";
import { writeCodePromptFactory } from "@prompts/factories/writeCodePromptFactory";
import stringify from "fast-json-stable-stringify";
import { getSectionTheme } from "@models/section";
import { themeContext } from "@prompts/helpers/context/theme";
import { type SectionTheme, BackgroundColorEnum } from "@models/section";

export const createLayoutPrompt = writeCodePromptFactory("createLayoutPrompt", async (state: GraphState, defaults: Record<string, any>) => {
    const files: FileMap = {}; // Don't need any file context for the layout... can optionally include package.json
    const sections = state.app.page?.plan.sections.map((section) => ({
        id: section.id,
        componentId: section.componentId,
        name: section.name
    }));
    const fileSpec = state.task.fileSpec as FileSpecification;
    const theme: SectionTheme = getSectionTheme(BackgroundColorEnum.White);
    const themeString = await themeContext(theme);

    const availableIcons = state.app?.codeTasks.completedTasks.flatMap((task) => task?.section?.contentPlan?.content.recommendedIcons).filter((x) => x !== undefined)
    const contentPlan = `
        You are making the: ${fileSpec.subtype} section.
        For context, here are the available sections available on the page. You may choose to include any or all of them in the ${fileSpec.subtype} section, with whatever name makes the most sense:
        ${stringify(sections)}
        Include as many links as you see fit. If you need to link, use the id of the section you want to link to as an anchor tag (e.g. /#sectionId)
        Prefer to use react-router-dom for navigation (DO NOT USE next/link)
        <recommended-icons>
            ${stringify(availableIcons)}
        </recommended-icons>
        <theme>
            ${themeString}
        </theme>
    `;

    const overrides = {
        files,
        contentPlan,
        userRequest: state.userRequest.content as string,
        languageString: "React/TSX",
    }
    return {
        ...defaults,
        ...overrides
    }
});
    