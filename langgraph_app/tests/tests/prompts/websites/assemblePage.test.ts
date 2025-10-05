import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { extractXmlTag, testGraph, xmlTest } from '@support';
import { databaseSnapshotter } from '@services';
import { routerGraph } from '@graphs';

describe.sequential('planComponent Prompt', async () => {
  beforeEach(async () => {
    vi.resetModules();
    await databaseSnapshotter.restoreSnapshot('basic_account');
  })
  
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it.only('should assemble the page using all components', async () => {
    const mainResult = await testGraph()
        .withGraph(routerGraph)
        .withPrompt(`Create a website about space exploration`)
        .withPromptSpy(['assemblePagePrompt'])
        .stopAfter('assemblePage')
        .execute();
      
    const result = mainResult.promptSpy?.get('assemblePagePrompt')[0];

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
          <react-component> HowItWorks </react-component>
          <react-component> Testimonials </react-component>
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
          import { HowItWorks } from "@/src/components/HowItWorks.tsx"
        </import-statement>
        <import-statement>
          import { Testimonials } from "@/src/components/Testimonials.tsx"
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