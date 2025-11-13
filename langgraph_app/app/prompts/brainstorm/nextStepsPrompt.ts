import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { BrainstormGraphState } from "@state";
import { chatHistoryPrompt } from "@prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const nextStepsPrompt = async (state: BrainstormGraphState) => {
  const uiGuide = fs.readFileSync(path.join(__dirname, 'topics/lookAndFeel.md'), 'utf-8');
  const chatHistory = await chatHistoryPrompt({ messages: state.messages, limit: 5 });

  const isFirstMessageInGroup = false;
  
  return `
    ${uiGuide}
    
    <what_we_accomplished>
      ${JSON.stringify(state.memories)}
    </what_we_accomplished>

    ${chatHistory}
    
    <task>
    Celebrate their completion (if we haven't yet) and guide them to next steps:
    1. Brand Personalization (optional)
    2. Build My Site button
    
    Make it clear both paths are valid.
    
    Output JSON: {
      "text": "Celebratory message + guidance",
      "examples": ["Option 1 explanation", "Option 2 explanation"],
      "conclusion": "Empowering question"
    }
    </task>
  `;
};