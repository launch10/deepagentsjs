import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { databaseSnapshotter } from '@services';
import { testGraph } from '@support';
import { routerGraph } from '@graphs';
import { isString } from '@types';
import { detect } from "@utils"
import { xmlTest } from '@tests/support/matchers/xml';

describe.sequential('createComponentPrompt', async () => {
  beforeEach(async () => {
    vi.resetModules();
    await databaseSnapshotter.restoreSnapshot('basic_account');
  })
  
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("should render with example inputs and correct structure", async () => {
    const graphResult = await testGraph()
        .withGraph(routerGraph)
        .withPrompt(`Create a website about space exploration`)
        .withPromptSpy(['createComponentPrompt'])
        .stopAfter('createComponent')
        .execute();

    const result = detect(
      graphResult.promptSpy?.get('createComponentPrompt'),
      (output: string) => output.match(/Create a component named: Hero/)
    )

    if (!isString(result)) {
      throw new Error('Result is not a string');
    }

    xmlTest(result)
      .expectSection('Role', `
        <role>
          You are a Code Generation Agent. Your task is to take a detailed plan 
          for a React component and generate the corresponding TSX using Shadcn UI
          and Tailwind CSS. The goal is to create beautiful, responsive, and 
          production-ready code based *strictly* on the provided plan and 
          design guidelines.
      </role>
    `).expectSection('Task', `
      <task>
        Generate the React/TSX code for the section detailed below
      </task>
    `).expectSection('ContentPlan', `
      <content-plan>
        {
          "content": {
            "componentType": "Hero",
            "ctaText": "Discover Our Mission",
            "headline": "The Final Frontier Awaits: Join Humanity's Greatest Adventure",
            "layoutVariant": "text-left-image-right",
            "paragraphs": "Space is not just a destination—it's humanity's next great frontier. Every moment, every mission, brings us closer to understanding our place in the universe.",
            "subheadline": "Explore the cosmos, push the boundaries of human knowledge, and be part of our journey beyond Earth",
            "suggestedComponents": [
              "@/components/ui/button.tsx",
              "@/components/ui/aspect-ratio.tsx"
            ],
            "trustSignals": [
              "Endorsed by NASA Researchers",
              "Featured in Scientific American",
              "5+ Years of Space Exploration Expertise"
            ],
            "visualConcept": "A breathtaking high-resolution image of a distant galaxy or nebula, with subtle particle effects suggesting stellar movement, captured by the Hubble Space Telescope or a similar high-quality astronomical image",
            "visualEmphasis": "image-focus"
          },
          "overview": {
            "backgroundColor": "primary",
            "context": "First impression section that sets the emotional tone for the entire landing page",
            "copy": "The Final Frontier Awaits: Join Humanity's Greatest Adventure",
            "name": "Hero",
            "purpose": "Capture immediate attention and communicate the grand vision of space exploration"
          }
        }
      </content-plan>
    `).expectSection('context', `
      <context>
        <landing-page-summary>
          A space exploration landing page that captures humanity's innate curiosity about the cosmos and our drive to explore the final frontier, focusing on the wonder, possibility and aspirational nature of space travel.
        </landing-page-summary>
        <user-request>
          Create a website about space exploration
        </user-request>
      </context>
    `).expectSection('components', `
      <suggested-shadcn-components>
        [
          "@/components/ui/button.tsx",
          "@/components/ui/aspect-ratio.tsx"
        ]
      </suggested-shadcn-components>
    `).expectSection('theme system', `
        <trust-system>
          Trust the System: Assume the contrast for both foreground variants 
          against their direct background is sufficient (4.5:1). Your task is 
          to apply the correct variant(s) based on semantic meaning and desired 
          emphasis.
        </trust-system>
    `).assertAll();

    // It gives instructions on component name based on fileSpec
    expect(result).toMatchXml(`
        **Component Name:** Create a component named: Hero. Give the component an ID of Hero, so that it can be used as an anchor for links.
    `);
    expect(result).toMatchXml(`
        **Use Named Export:** Export the component as Hero. DO NOT USE default export.
    `);
  });

  it('renders different instructions based on fileSpec', async () => {
    const graphResult = await testGraph()
        .withGraph(routerGraph)
        .withPrompt(`Create a website about space exploration`)
        .withPromptSpy(['createComponentPrompt'])
        .stopAfter('createComponent')
        .execute();

    const result = detect(
      graphResult.promptSpy?.get('createComponentPrompt'),
      (output: string) => output.match(/Create a component named: Features/)
    )
    
    if (!isString(result)) {
      throw new Error('Result is not a string');
    }

    xmlTest(result)
      .expectSection('Content Plan', `
        <content-plan>
        {
          "content": {
            "componentType": "Features",
            "cta": "Join the Cosmic Journey",
            "features": [
              {
                "description": "Cutting-edge propulsion systems and materials that enable longer, safer journeys into deep space, pushing the boundaries of human exploration beyond previous limitations.",
                "name": "Advanced Spacecraft Technology",
                "visual": "rocket icon from lucide-react"
              },
              {
                "description": "Comprehensive global and interplanetary monitoring systems that provide unprecedented insights into planetary dynamics, climate patterns, and cosmic phenomena.",
                "name": "Satellite Observation Networks",
                "visual": "telescope icon from lucide-react"
              },
              {
                "description": "Modular research stations designed to support extended missions, enabling scientific teams to conduct groundbreaking experiments in microgravity and extreme environments.",
                "name": "Interplanetary Research Platforms",
                "visual": "satellite icon from lucide-react"
              }
            ],
            "headline": "Exploring the Cosmic Frontier",
            "paragraphs": "Space exploration represents more than technological achievement—it's a testament to human curiosity, innovation, and our collective potential to transcend known boundaries. Each mission expands our understanding of the universe and our place within it.",
            "subheadline": "Transforming Humanity's Greatest Adventure into Tangible Progress",
            "suggestedComponents": [
              "@/components/ui/card.tsx",
              "@/components/ui/icons/telescope.tsx",
              "@/components/ui/icons/rocket.tsx"
            ]
          },
          "overview": {
            "backgroundColor": "secondary",
            "context": "Provide context for why space exploration matters and why now is an exciting time",
            "copy": "For millennia, humans have gazed at the stars and dreamed of reaching them. Today, that dream is becoming reality. But space exploration isn't just about rockets and satellites - it's about expanding the realm of human possibility.",
            "name": "Features",
            "purpose": "Articulate the historical human desire to explore space and frame the opportunity"
          }
        }
      `)
    .assertAll();

    // It gives instructions on component name based on fileSpec
    expect(result).toMatchXml(`
        **Component Name:** Create a component named: Features. Give the component an ID of Features, so that it can be used as an anchor for links.
    `);
    expect(result).toMatchXml(`
        **Use Named Export:** Export the component as Features. DO NOT USE default export.
    `);
  });

  it("should work for Nav component", async () => {
    const graphResult = await testGraph()
        .withGraph(routerGraph)
        .withPrompt(`Create a website about space exploration`)
        .withPromptSpy(['createComponentPrompt'])
        .stopAfter('createComponent')
        .execute();

    const result = detect(
      graphResult.promptSpy?.get('createComponentPrompt'),
      (output: string) => output.match(/Create a component named: Nav/)
    )

    if (!isString(result)) {
      throw new Error('Result is not a string');
    }

    xmlTest(result)
      .expectSection('Content Plan', `
          <content-plan>
            {
              "content": {
                "availableSections": [
                  "Hero",
                  "Features",
                  "HowItWorks",
                  "Testimonials",
                  "CTA"
                ],
                "componentType": "Nav"
              },
              "overview": {
                "backgroundColor": "primary",
                "context": "Core navigation element",
                "copy": null,
                "name": "Nav",
                "purpose": "Provide navigation"
              }
            }
          </content-plan>
    `)
    .assertAll();

    expect(result).toMatchCode(`
      Linking: If you need to link, use the id of the section you want to
    link to as an anchor tag (e.g. /#sectionId)
    `);
  });

  it("should work for Footer component", async () => {
    const graphResult = await testGraph()
        .withGraph(routerGraph)
        .withPrompt(`Create a website about space exploration`)
        .withPromptSpy(['createComponentPrompt'])
        .stopAfter('createComponent')
        .execute();

    const result = detect(
      graphResult.promptSpy?.get('createComponentPrompt'),
      (output: string) => output.match(/Create a component named: Footer/)
    )

    if (!isString(result)) {
      throw new Error('Result is not a string');
    }

    xmlTest(result)
      .expectSection('Content Plan', `
          <content-plan>
            {
              "content": {
                "availableSections": [
                  "Hero",
                  "Features",
                  "HowItWorks",
                  "Testimonials",
                  "CTA"
                ],
                "componentType": "Footer"
              },
              "overview": {
                "backgroundColor": "primary",
                "context": "Core navigation element",
                "copy": null,
                "name": "Footer",
                "purpose": "Provide navigation"
              }
            }
          </content-plan>
    `)
    .assertAll();

    expect(result).toMatchCode(`
      Linking: If you need to link, use the id of the section you want to                                                          link to as an anchor tag (e.g. /#sectionId)
      Prefer to use react-router-dom for navigation (DO NOT USE next/link)
    `);
  });
});