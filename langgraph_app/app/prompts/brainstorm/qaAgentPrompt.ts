import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { BrainstormGraphState } from "@state";
import { isHumanMessage } from "@types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const qaAgentPrompt = (state: BrainstormGraphState) => {
    if (!state.currentTopic) {
        throw new Error("qaAgentPrompt called without currentTopic");
    }
    
    const coreCriteria = fs.readFileSync(path.join(__dirname, 'qa/core.md'), 'utf-8');
    const topicCriteria = fs.readFileSync(path.join(__dirname, `qa/${state.currentTopic}.md`), 'utf-8');
    const memories = (state.memories || {})[state.currentTopic] || 'No answer yet';
  
    return `
        ${coreCriteria}
        
        ${topicCriteria}
        
        <current_topic>${state.currentTopic}</current_topic>
        
        <user_answer>${state.messages.filter(isHumanMessage).at(-1)?.content}</user_answer>
        
        <existing_memory>${memories}</existing_memory>
        
        <task>
        Evaluate if their answer is GREAT based on the criteria above.
        Output JSON: { "success": boolean, "reasoning": string }
        </task>
    `;
};