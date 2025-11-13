import fs from "fs";
import path from "path";
import type { BrainstormGraphState } from "@state";
import { isHumanMessage } from "@types";
import { chatHistoryPrompt } from "@prompts";

export const clarificationPrompt = async (state: BrainstormGraphState) => {
  const brainstormCore = fs.readFileSync(path.join(__dirname, 'topics/core.md'), 'utf-8');
  const topicGuide = fs.readFileSync(path.join(__dirname, `topics/${state.currentTopic}.md`), 'utf-8');
  const qaReasoning = state.qa!.reasoning; // From previous QA evaluation
  const chatHistory = await chatHistoryPrompt({ messages: state.messages });
  
  return `
    ${brainstormCore}
    
    ${topicGuide}
    
    <current_topic>${state.currentTopic}</current_topic>
    
    <their_answer>${state.messages.filter(isHumanMessage).at(-1)?.content}</their_answer>
    
    <qa_evaluation>
    Success: false
    Reasoning: ${qaReasoning}
    </qa_evaluation>
    
    <chat_history>
        ${chatHistory}
    </chat_history>
    
    <task>
    Their answer isn't GREAT yet. Ask a specific follow-up that addresses 
    the weakness identified in the QA evaluation.
    
    Be constructive and encouraging:
    1. Acknowledge what was good
    2. Identify the specific gap
    3. Ask targeted follow-up
    4. Provide examples
    
    Output JSON: {
      "text": "Your clarifying question",
      "examples": ["Guiding example 1", "Example 2"],
      "conclusion": "Encouraging restatement"
    }
    </task>
  `;
};