import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { extractXmlTag, testGraph, xmlTest } from '@support';
import { databaseSnapshotter } from '@services';
import { routerGraph } from '@graphs';
import { isString, isArray, isUndefined } from '@types';

describe.sequential('planComponent Prompt', async () => {
  beforeEach(async () => {
    vi.resetModules();
    await databaseSnapshotter.restoreSnapshot('basic_account');
  })
  
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should assemble the page using all components', async () => {
    const mainResult = await testGraph()
        .withGraph(routerGraph)
        .withPrompt(`Create a website about space exploration`)
        .withPromptSpy(['assemblePagePrompt'])
        .stopAfter('assemblePage')
        .execute();
      
    const prompts = mainResult.promptSpy?.get('assemblePagePrompt');

    if (isUndefined(prompts) || !isArray(prompts)) {
      throw new Error('prompts is not an array');
    }

    if (prompts.length !== 1) {
      throw new Error('prompts is not an array of length 1');
    }

    const result = prompts[0];

    if (!isString(result)) {
      throw new Error('Result is not a string');
    }

    xmlTest(result)
      .expectSection('Role definition', `
        <role>
          You are the Page Assembly Agent.
      `)
      .expectSection('Page plan', `
        <page-plan>
          <react-component> Nav </react-component>
          <react-component> Hero </react-component>
          <react-component> Features </react-component>
          <react-component> Benefits </react-component>
          <react-component> Testimonials </react-component>
          <react-component> SocialProof </react-component>
          <react-component> CTA </react-component>
          <react-component> Footer </react-component>
      </page-plan>
    `)
    .expectSection('Import statements', `
      <import-statements>
        <import-statement>
          import { Nav } from "@/src/components/Nav.tsx"
        </import-statement>
        <import-statement>
          import { Hero } from "@/src/components/Hero.tsx"
        </import-statement>
        <import-statement>
          import { Features } from "@/src/components/Features.tsx"
        </import-statement>
        <import-statement>
          import { Benefits } from "@/src/components/Benefits.tsx"
        </import-statement>
        <import-statement>
          import { Testimonials } from "@/src/components/Testimonials.tsx"
        </import-statement>
        <import-statement>
          import { SocialProof } from "@/src/components/SocialProof.tsx"
        </import-statement>
        <import-statement>
          import { CTA } from "@/src/components/CTA.tsx"
        </import-statement>
        <import-statement>
          import { Footer } from "@/src/components/Footer.tsx"
        </import-statement>
      </import-statements>
    `)
    .expectSection('Files', `
      <files>
        No existing files provided.
    `)
    .assertAll();
  });
});