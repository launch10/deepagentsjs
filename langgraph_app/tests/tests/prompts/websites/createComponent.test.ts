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
    console.log(result)

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
            "ctaText": "Begin Your Cosmic Journey",
            "headline": "The Final Frontier Is Calling. Will You Answer?",
            "layoutVariant": "text-left-image-right",
            "paragraphs": "Discover the boundless possibilities of space travel, scientific discovery, and humanity's next great adventure. From distant galaxies to unexplored planets, your exploration starts here.",
            "subheadline": "Embark on a journey beyond our world, where human curiosity meets cosmic exploration",
            "suggestedComponents": [
              "@/components/ui/button.tsx",
              "@/components/ui/aspect-ratio.tsx"
            ],
            "trustSignals": [
              "Endorsed by NASA Researchers",
              "Featured in Scientific American",
              "5+ Years of Space Exploration Insights"
            ],
            "visualConcept": "A breathtaking, high-resolution image of a spacecraft against a backdrop of stars and a distant nebula, with subtle particle animations suggesting movement and possibility",
            "visualEmphasis": "image-focus"
          },
          "overview": {
            "backgroundColor": "primary",
            "context": "First section that sets the tone and inspires visitors to engage with the space exploration journey",
            "copy": "The Final Frontier Is Calling. Will You Answer?",
            "name": "Hero",
            "purpose": "Capture immediate attention and communicate the core emotional driver of space exploration"
          }
        }
      </content-plan>
    `).expectSection('context', `
      <context>
        <landing-page-summary>
          A space exploration landing page that captures humanity's innate curiosity about the cosmos and inspires wonder about our future among the stars
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
              "cta": "Start Your Space Journey",
              "features": [
                {
                  "description": "Commercial space flight is transforming from science fiction to reality. Companies like SpaceX and Blue Origin are making space more accessible than ever before, offering unprecedented opportunities for civilian space exploration.",
                  "name": "Private Space Travel",
                  "visual": "rocket icon from lucide-react"
                },
                {
                  "description": "Advanced technologies and online platforms now allow everyday people to contribute to real space research. From analyzing satellite data to participating in crowdsourced astronomical observations, anyone can be a space explorer.",
                  "name": "Citizen Science",
                  "visual": "telescope icon from lucide-react"
                },
                {
                  "description": "Cutting-edge telescopes and satellite networks are providing unprecedented views of the universe. High-resolution imaging and real-time data streaming bring cosmic discoveries directly to your fingertips.",
                  "name": "Advanced Observation Technologies",
                  "visual": "satellite icon from lucide-react"
                }
              ],
              "headline": "Space Exploration: No Longer Just a Dream",
              "paragraphs": "For millennia, humans have gazed at the stars and wondered what lies beyond. Today, space exploration isn't just the domain of government agencies - it's becoming accessible to dreamers, innovators, and pioneers like you.",
              "subheadline": "Discover How Modern Technology is Opening the Cosmos to Everyone",
              "suggestedComponents": [
                "@/components/ui/card.tsx",
                "@/components/ui/icons/telescope.tsx",
                "@/components/ui/icons/rocket.tsx"
              ]
            },
            "overview": {
              "backgroundColor": "secondary",
              "context": "Explain how space exploration has evolved and is now more accessible than ever",
              "copy": "For millennia, humans have gazed at the stars and wondered what lies beyond. Today, space exploration isn't just the domain of government agencies - it's becoming accessible to dreamers, innovators, and pioneers like you.",
              "name": "Features",
              "purpose": "Articulate the historical context and current accessibility of space exploration"
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
                "Benefits",
                "SocialProof",
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
                "Benefits",
                "SocialProof",
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