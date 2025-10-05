import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { projectNameGeneratorTool } from "@tools/generateProjectName";
import { getLlm, LLMSkill, LLMSpeed } from "@core/llm";

export const agent = createReactAgent({
    llm: getLlm(LLMSkill.Writing, LLMSpeed.Slow),
    tools: [projectNameGeneratorTool]
});