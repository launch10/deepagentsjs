import { type GraphState } from "@shared/state/graph";
import { baseNode } from "@nodes/core/templates/base";
import { fileSpecRegistry } from "@models/registry/fileSpecificationRegistry";
import { FileTypeEnum } from "@models/enums";
import { SectionTypeEnum } from "@models/enums";
import { loadMockGraphState } from "@services/mockDataService"; 

export const setupNode = baseNode({
    nodeName: "setup",
    nodeFn: async (state: GraphState) => {
        // state = loadMockGraphState(state);
        if (state.task.fileSpec) {
            return state;
        }

        const { section } = state.task;

        if (!section) {
            throw new Error("Section is missing from worker state.");
        }

        // Attach fileSpec to task
        const sectionType = section.sectionType as SectionTypeEnum;
        const spec = fileSpecRegistry.getByType(FileTypeEnum.Section, sectionType);
        state.task.fileSpec = spec;

        return state;
    }
});