import { baseNode } from "@nodes/core/templates/base";
import { planCreateSectionPrompt } from "~/lib/.server/langgraph/prompts/createPage/createSection";
import type { GraphState } from "@shared/state/graph";
import { LLMSkill, getLlm } from "@langgraph/llm";
import type { Section, ContentPlan, SectionOverview } from "@models/section";
import type { SectionType } from "@models/registry/sectionRegistry";
import { sectionLayoutSchema } from "@models/section";
import type { FileSpecification } from "@models/fileSpecification";
import { HumanMessage } from "@langchain/core/messages";
import { initializeTools as initializeSearchIcons } from "@langgraph/tools/searchIcons";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getRandomSectionTheme } from "@models/section";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

// Plan the content that goes in a particular page section
export async function planCreateSection(state: GraphState): Promise<Partial<GraphState>> {
  const { task } = state;

  if (!task.section) {
    throw new Error(`Task ${task.id} is missing the 'section' property.`);
  }

  const fileSpec = task.fileSpec as FileSpecification;

  const specificSectionSchema = fileSpec?.schema;
  if (!specificSectionSchema) {
      throw new Error(`Schema not found for section type: ${fileSpec?.subtype} in fileSpec for task ${task.id}`);
  }

  const schema = sectionLayoutSchema.merge(specificSectionSchema);
  const llm = getLlm(LLMSkill.Planning);
  const prompt = await planCreateSectionPrompt(state);

  const agentState = {
    ...state,
    messages: [new HumanMessage({ content: state.userRequest.content })]
  };

  // So the agent can search for icons
  const { searchIcons } = await initializeSearchIcons(agentState);
  const tools = [searchIcons];
  const agent = createReactAgent({
      llm,
      tools,
      prompt,
      responseFormat: schema,
  });

  const agentOutput = await agent.invoke(agentState);
  const plannedContent = agentOutput.structuredResponse;

  const section = task.section as Section;
  const contentPlan = section.contentPlan || {} as ContentPlan;
  contentPlan.content = plannedContent as SectionType;

  if (!task.section.theme) {
    task.section.theme = getRandomSectionTheme();
  }
  task.section.contentPlan = contentPlan;
  return { task: task }
}

export const planCreateSectionNode = baseNode({
  nodeName: "planCreateSection",
  nodeFn: planCreateSection,
  buildTask: (state: GraphState, config: LangGraphRunnableConfig) => {
    const { task } = state;
    if (!task.section) {
      return {
        title: "Outlining next section"
      }
    }

    const section = task.section as Section;
    const sectionOverview = section.contentPlan?.overview as SectionOverview;

    return {
        title: `Drafting outline for ${sectionOverview.name}`,
    };
  }
});
