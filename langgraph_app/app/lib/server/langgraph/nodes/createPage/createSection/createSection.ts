import { createSectionPrompt } from "~/lib/server/langgraph/prompts/createPage/createSection";
import { type GraphState } from "@shared/state/graph";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { completeCodeTask } from "../../actions/codeTasks";
import { executeCodePrompt } from "../../actions/codeTasks";
import { baseNode } from "@nodes/core/templates/base";

const createSection = async(state: GraphState, config: LangGraphRunnableConfig): Promise<Partial<GraphState>> => {
  const results = await executeCodePrompt(createSectionPrompt, state);
  const task = completeCodeTask(state, results);

  return {
    app: {
        codeTasks: {
            completedTasks: [task as CompletedCodeTask],
        }
    }
  }
}

export const createSectionNode = baseNode({
    nodeName: "createSectionNode",
    nodeFn: createSection,
    buildTaskTitle: (state: GraphState, config: LangGraphRunnableConfig) => {
      const { task } = state;
      if (!task.section) {
        return {
          title: "Coding next section"
        }
      }

      const section = task.section as Section;
      const sectionOverview = section.contentPlan?.overview as SectionOverview;

      return {
          title: `Writing code for ${sectionOverview.name}`,
      };
    }
});