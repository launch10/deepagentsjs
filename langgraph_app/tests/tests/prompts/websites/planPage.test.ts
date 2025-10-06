import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { testGraph } from '@support';
import { databaseSnapshotter } from '@services';
import { routerGraph } from '@graphs';

describe.sequential('planPage Prompt', async () => {
  beforeEach(async () => {
    vi.resetModules();
    await databaseSnapshotter.restoreSnapshot('basic_account');
  })
  
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  
  it('should render with example inputs and correct structure', async () => {
      const result = await testGraph()
          .withGraph(routerGraph)
          .withPrompt(`Create a website about space exploration`)
          .withPromptSpy(['planPagePrompt'])
          .stopAfter('planPage')
          .execute();

      // Check that we captured the prompt output
      expect(result.promptSpy).toBeDefined();
      expect(result.promptSpy?.has('planPagePrompt')).toBe(true);
      
      const promptOutput = result.promptSpy?.get('planPagePrompt')?.[0];
      expect(promptOutput).toBeDefined();

      expect(promptOutput).toMatchXml(`
        <attention-grabber>
          The Stars Are Calling. Will You Answer?
        </attention-grabber>
      `);
      expect(promptOutput).toMatchXml(`
        <user-request>
          Create a website about space exploration
      `);
      expect(promptOutput).toContain('<structured-output>');
      expect(promptOutput).toMatchXml(`
        "enum":["IndexPage","PricingPage",
      `);
  });
});