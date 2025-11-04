import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { projectNameGeneratorTool } from "@tools/generateProjectName";
import { getLLM, LLMSkill, LLMSpeed } from "@core/llm";

export const agent = createReactAgent({
    llm: getLLM(writing, slow),
    tools: [projectNameGeneratorTool]
});