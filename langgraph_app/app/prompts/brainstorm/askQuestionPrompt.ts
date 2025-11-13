import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { BrainstormGraphState } from "@state";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const askQuestionPrompt = (state: BrainstormGraphState) => {
  const brainstormCore = fs.readFileSync(path.join(__dirname, 'topics/core.md'), 'utf-8');
  const topicGuide = fs.readFileSync(path.join(__dirname, `topics/${state.currentTopic}.md`), 'utf-8');

  // TODO: Turn into bite-sized, queryable snippets using RAG
  const godinRef = fs.readFileSync(path.join(__dirname, 'references/godin.md'), 'utf-8'); // Optional: for enrichment
  const hormoziRef = fs.readFileSync(path.join(__dirname, 'references/hormozi.md'), 'utf-8'); // Optional: for enrichment
  
  return `
    ${brainstormCore}
    
    ${topicGuide}
    
    <current_topic>${state.currentTopic}</current_topic>
    
    <what_we_know>${JSON.stringify(state.memories)}</what_we_know>
    
    <optional_frameworks>
        ${godinRef}
        ${hormoziRef}
        Use these principles naturally if relevant - don't force them.
    </optional_frameworks>
    
    <task>
    Ask the user about ${state.currentTopic} in a warm, conversational way.
    Reference previous answers naturally if relevant.
    Provide 2-3 concrete examples to inspire them.
    
    Output JSON: {
      "text": "Your question/message",
      "examples": ["Example 1", "Example 2", "Example 3"], // Optional
      "conclusion": "Encouraging wrap-up" // Optional
    }
    </task>

    <important>
      Be extremely concise. Sacrifice grammar for conciseness.
    </important>

  `;
};