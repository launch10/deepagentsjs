import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { BrainstormGraphState } from "@state";
import { MessageTagger } from "@nodes";
import { chatHistoryPrompt } from "@prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const qaAgentPrompt = async (state: BrainstormGraphState) => {
    if (!state.currentTopic) {
        throw new Error("qaAgentPrompt called without currentTopic");
    }
    
    const coreCriteria = fs.readFileSync(path.join(__dirname, 'qa/core.md'), 'utf-8');
    const topicCriteria = fs.readFileSync(path.join(__dirname, `qa/${state.currentTopic}.md`), 'utf-8');
    const memories = (state.memories || {})[state.currentTopic] || 'No answer yet';
    const untaggedMessages = new MessageTagger(state.messages, state.currentTopic).untaggedMessages();
    const messageHistory = await chatHistoryPrompt({ messages: untaggedMessages });
  
    return `
        ${coreCriteria}
        
        ${topicCriteria}
        
        <current_topic>${state.currentTopic}</current_topic>

        <existing_memory>${memories}</existing_memory>
        
        <chat_history>
          ${messageHistory}
        </chat_history>
        
        <task>
        Evaluate if their answer is GREAT based on the criteria above.
        Output JSON: { "success": boolean, "reasoning": string }
        </task>
    `;
};