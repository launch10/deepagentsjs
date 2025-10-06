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
            "ctaText": "Explore the Cosmos",
            "headline": "The Stars Are Calling. Will You Answer?",
            "layoutVariant": "text-left-image-right",
            "paragraphs": null,
            "subheadline": "Embark on a journey beyond our world, where every discovery brings us closer to understanding the infinite universe.",
            "suggestedComponents": [
              "@/components/ui/button.tsx",
              "@/components/ui/aspect-ratio.tsx"
            ],
            "trustSignals": [
              "Backed by NASA Research",
              "Trusted by Leading Astronomers"
            ],
            "visualConcept": "A breathtaking high-resolution image of a distant galaxy, with vibrant blues and purples, showcasing the depth and mystery of space. The image should have a slight parallax effect to create depth and movement.",
            "visualEmphasis": "image-focus"
          },
          "overview": {
            "backgroundColor": "primary",
            "context": "First impression section that sets the emotional tone for the entire landing page",
            "copy": "The Stars Are Calling. Will You Answer?",
            "name": "Hero",
            "purpose": "Capture immediate attention and inspire users to explore space"
          }
        }
      </content-plan>
    `).expectSection('context', `
      <context>
        <landing-page-summary>
          A space exploration landing page that taps into humanity's innate wonder about the cosmos and desire to be part of something bigger than ourselves. The copy focuses on making space exploration personal and accessible while maintaining scientific credibility.
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
                  "description": "Experience immersive, scientifically accurate simulations of space exploration. Navigate spacecraft, conduct experiments, and explore distant planets from the comfort of your home.",
                  "name": "Virtual Space Missions",
                  "visual": "Telescope icon representing exploration and discovery"
                },
                {
                  "description": "Access live feeds, satellite imagery, and cutting-edge research directly from space agencies. Stay connected with the latest discoveries and scientific breakthroughs.",
                  "name": "Real-Time Space Data",
                  "visual": "Rocket icon symbolizing active exploration"
                },
                {
                  "description": "Join a global network of space enthusiasts, scientists, and dreamers. Participate in forums, webinars, and collaborative research projects that push the boundaries of human knowledge.",
                  "name": "Community of Explorers",
                  "visual": "Constellation-like connecting graphic representing community"
                }
              ],
              "headline": "Unlock the Mysteries of Space Exploration",
              "paragraphs": "For too long, space has felt distant and unreachable. We're changing that by bringing the universe closer to you, making space exploration accessible, engaging, and deeply personal.",
              "subheadline": "Breaking down barriers between humanity and the cosmos",
              "suggestedComponents": [
                "@/components/ui/card.tsx",
                "@/components/ui/icons/telescope.tsx",
                "@/components/ui/icons/rocket.tsx"
              ]
            },
            "overview": {
              "backgroundColor": "secondary",
              "context": "Highlight the historical barrier to space exploration and create empathy",
              "copy": "For too long, space has felt distant and unreachable. We've gazed up at the night sky, dreaming of what lies beyond, but feeling like space exploration was something that happened to other people, in other places.",
              "name": "Features",
              "purpose": "Articulate the current challenge in space exploration accessibility"
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
                "Testimonials",
                "SocialProof",
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
                "Testimonials",
                "SocialProof",
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