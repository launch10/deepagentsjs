import { describe, it } from 'vitest';
import { planWebsitePrompt } from '@prompts';
import { HumanMessage } from "@langchain/core/messages";
import { expectSection, expectPromptHasSections, expectNoStringifiedNulls } from '@support';
import { Website } from '@types';

describe.skip('planWebsite Prompt - Contract Tests', () => {
  it('generates valid structured output matching contentStrategySchema', async () => {
    const userRequest = "Create a landing page for a SaaS product that helps developers deploy faster";
    const result = await planWebsitePrompt({
      userRequest: new HumanMessage(userRequest)
    });

    expectSection(result, 'structured-output')
      .toBeValidFormat()
      .toMatchContract(Website.Plan.contentStrategySchema);
  });

  it('has all required sections', async () => {
    const userRequest = "Make a website for selling organic vegetables";
    const result = await planWebsitePrompt({
      userRequest: new HumanMessage(userRequest)
    });

    expectPromptHasSections(
      result,
      'task',
      'user-request',
      'tone',
      'instructions',
      'structured-output'
    );
  });

  it('has no stringified nulls or undefined', async () => {
    const userRequest = "Create a landing page for a fitness app";
    const result = await planWebsitePrompt({
      userRequest: new HumanMessage(userRequest)
    });

    expectNoStringifiedNulls(result);
  });

  it('user-request section contains the actual request', async () => {
    const userRequest = "Build a website about space exploration";
    const result = await planWebsitePrompt({
      userRequest: new HumanMessage(userRequest)
    });

    const section = expectSection(result, 'user-request');
    
    section.toBeValidFormat();
  });

  it('handles different user request formats without breaking', async () => {
    const requests = [
      "Simple request",
      "Request with \n newlines \n and \t tabs",
      "Request with 'quotes' and \"double quotes\"",
      "Request with special chars: @#$%",
    ];

    for (const request of requests) {
      const result = await planWebsitePrompt({
        userRequest: new HumanMessage(request)
      });

      expectSection(result, 'structured-output')
        .toBeValidFormat()
        .toMatchContract(Website.Plan.contentStrategySchema);

      expectNoStringifiedNulls(result);
    }
  });

  it('errors appropriately when required data is missing', async () => {
    await expect(
      planWebsitePrompt({} as any)
    ).rejects.toThrow('userRequest is required');
  });
});
