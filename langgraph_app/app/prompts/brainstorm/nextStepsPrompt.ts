import fs from "fs";
import path from "path";
import type { BrainstormGraphState } from "@state";

export const nextStepsPrompt = (state: BrainstormGraphState) => {
  const uiGuide = fs.readFileSync(path.join(__dirname, 'topics/lookAndFeel.md'), 'utf-8');
  
  return `
    ${uiGuide}
    
    <what_we_accomplished>
    ${JSON.stringify(state.memories)}
    </what_we_accomplished>
    
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