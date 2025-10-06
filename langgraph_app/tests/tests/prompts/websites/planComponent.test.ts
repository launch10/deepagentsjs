import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { testGraph, xmlTest } from '@support';
import { databaseSnapshotter } from '@services';
import { routerGraph } from '@graphs';
import { detect } from "@utils"
import { schemaRegistry, isString } from '@types';
import { StructuredOutputParser } from "@langchain/core/output_parsers";

describe.sequential('planComponentPrompt', () => {
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
        .withPromptSpy(['planComponentPrompt'])
        .stopAfter('planComponent')
        .execute();

    expect(result.state.error).toBeUndefined();

    const promptOutput = detect(
      result.promptSpy?.get('planComponentPrompt'),
      (output: string) => output.match(/The goal of the Hero section/)
    )

    if (!isString(promptOutput)) {
      throw new Error('Prompt output not found');
    }

    xmlTest(promptOutput)
      .expectSection('Role definition', `
        <role>
          You are a Section Planner Agent
      `)
      .expectSection('Project summary', `
        <project-summary>
          A space exploration landing page
      `)
      .expectSection('Hero section goal', `
        <section-goal>
          The goal of the Hero section is to immediately capture visitor attention,
      `)
      .expectSection('Brand guidelines', `
        <brand-guidelines>
          <overall-tone>
            Inspirational and awe-inspiring, with a foundation of scientific authority
          </overall-tone>
          <page-mood>
            Like looking through a telescope at a newly discovered galaxy - awe-inspiring yet accessible, mixing wonder with scientific credibility
          </page-mood>
          <visual-evocation>
            Deep space imagery with pin-sharp stars against infinite black, clean modern typography, strategic use of bioluminescent blues and purples, constellation-like connecting elements, and smooth parallax scrolling effects that evoke movement through space
          </visual-evocation>
        </brand-guidelines>
      `)
      .expectSection('Component overview', `
        <component-overview>
          <background-color>
            primary
          </background-color>
          <context>
            First impression section that sets the emotional tone for the entire landing page
          </context>
          <copy>
            The Stars Are Calling. Will You Answer?
          </copy>
          <name>
            Hero
          </name>
          <purpose>
            Capture immediate attention and inspire users to explore space
          </purpose>
          <text-color>
            Suggest a color that contrasts well with the background color, ideally a color from the global brand theme.
          </text-color>
        </component-overview>
      `)
      .expectSection('Lucide icons instruction', `
        <important>
          For visual elements, ONLY use Lucide icons
      `)
      .expectSection('Shadcn components list', `
        <available-shad-cn-components>
          <component>@/components/ui/accordion.tsx</component>
          <component>@/components/ui/alert-dialog.tsx</component>
      `)
      .assertAll();
      
    // Keep the schema test separate as it's more complex
    const schema = schemaRegistry["Hero" as ComponentTypeEnum].schema;
    const parser = StructuredOutputParser.fromZodSchema(schema);
    const formatInstructions = parser.getFormatInstructions();
    expect(promptOutput).toMatchXml(formatInstructions);
  });

  it('plans Nav section', async () => {
    const result = await testGraph()
        .withGraph(routerGraph)
        .withPrompt(`Create a website about space exploration`)
        .withPromptSpy(['planComponentPrompt'])
        .stopAfter('planComponent')
        .execute();

    const promptOutput = detect(
      result.promptSpy?.get('planComponentPrompt'),
      (output: string) => output.match(/The goal of the Nav section/)
    )

    if (!isString(promptOutput)) {
      throw new Error('Prompt output not found');
    }

    xmlTest(promptOutput)
      .expectSection('Goal', `
        <section-specific-instructions>
          <section-goal>
            The goal of the Nav section is to provide a clear and concise 
            navigation menu for the website.
      `)
      .expectSection('Available sections', `
      <available-sections>
        <section>Hero</section>
        <section>Features</section>
        <section>Benefits</section>
        <section>Testimonials</section>
        <section>SocialProof</section>
        <section>CTA</section>
      </available-sections>
    `)
    .assertAll();

    const schema = schemaRegistry['Nav'].schema;
    const parser = StructuredOutputParser.fromZodSchema(schema);
    const formatInstructions = parser.getFormatInstructions();
    expect(promptOutput).toMatchXml(formatInstructions);
  });

  it('plans Footer section', async () => {
    const result = await testGraph()
        .withGraph(routerGraph)
        .withPrompt(`Create a website about space exploration`)
        .withPromptSpy(['planComponentPrompt'])
        .stopAfter('planComponent')
        .execute();

    const promptOutput = detect(
      result.promptSpy?.get('planComponentPrompt'),
      (output: string) => output.match(/The goal of the Footer section/)
    )

    if (!isString(promptOutput)) {
      throw new Error('Prompt output not found');
    }

    xmlTest(promptOutput)
      .expectSection('Goal', `
          <section-goal>
            The goal of the Footer section is
      `)
      .expectSection('Available sections', `
      <available-sections>
        <section>Hero</section>
        <section>Features</section>
        <section>Benefits</section>
        <section>Testimonials</section>
        <section>SocialProof</section>
        <section>CTA</section>
      </available-sections>
    `)
    .assertAll();

    const schema = schemaRegistry['Footer'].schema;
    const parser = StructuredOutputParser.fromZodSchema(schema);
    const formatInstructions = parser.getFormatInstructions();
    expect(promptOutput).toMatchXml(formatInstructions);
  });
});