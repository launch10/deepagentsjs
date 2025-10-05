import { describe, it, expect } from 'vitest';
import { planWebsitePrompt } from '@prompts';
import { HumanMessage } from "@langchain/core/messages";

describe.sequential('planWebsite Prompt', () => {
  it('should render with example inputs and correct structure', async () => {
    const userRequest = "Make me a really cool landing page for a business that sells butternut squash";
    const result = await planWebsitePrompt({
      userRequest: new HumanMessage(userRequest)
    });

    expect(result).toMatchXml(`
      <task>
        Generate Emotionally Resonant Copy
    `);

    expect(result).toMatchXml(`
      ${userRequest}
    `);
    
  });

  it('errors when userRequest is missing', async () => {
    expect(planWebsitePrompt({})).rejects.toThrow('userRequest is required');
  });
});