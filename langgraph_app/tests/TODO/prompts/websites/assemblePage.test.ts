// import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// import { extractXmlTag, testGraph, xmlTest } from '@support';
// import { DatabaseSnapshotter } from '@services';
// import { routerGraph } from '@graphs';
// import { isString, isArray, isUndefined } from '@types';

// describe.sequential('planComponent Prompt', async () => {
//   beforeEach(async () => {
//     vi.resetModules();
//     await DatabaseSnapshotter.restoreSnapshot('basic_account');
//   })
  
//   afterEach(() => {
//     vi.resetModules();
//     vi.clearAllMocks();
//   });

//   it('should assemble the page using all components', async () => {
//     const mainResult = await testGraph()
//         .withGraph(routerGraph)
//         .withPrompt(`Create a website about space exploration`)
//         .withPromptSpy(['assemblePagePrompt'])
//         .stopAfter('assemblePage')
//         .execute();
      
//     const prompts = mainResult.promptSpy?.get('assemblePagePrompt');

//     if (isUndefined(prompts) || !isArray(prompts)) {
//       throw new Error('prompts is not an array');
//     }

//     if (prompts.length !== 1) {
//       throw new Error('prompts is not an array of length 1');
//     }

//     const result = prompts[0];

//     if (!isString(result)) {
//       throw new Error('Result is not a string');
//     }

//     xmlTest(result)
//       .expectSection('Role definition', `
//         <role>
//           You are the Page Assembly Agent.
//       `)
//       .expectSection('Page plan', `
//         <expected-components>
//           Nav
//           Hero
//           Features
//           Benefits
//           SocialProof
//           Testimonials
//           CTA
//           Footer
//         </expected-components>
//     `)
//     .expectSection('Import statements', `
//       <import-statements>
//         import { Nav } from "@/src/components/Nav.tsx"
//         import { Hero } from "@/src/components/Hero.tsx"
//         import { Features } from "@/src/components/Features.tsx"
//         import { Benefits } from "@/src/components/Benefits.tsx"
//         import { SocialProof } from "@/src/components/SocialProof.tsx"
//         import { Testimonials } from "@/src/components/Testimonials.tsx"
//         import { CTA } from "@/src/components/CTA.tsx"
//         import { Footer } from "@/src/components/Footer.tsx"
//       </import-statements>

//     `)
//     .expectSection('Files', `
//       <files>
//         No existing files provided.
//     `)
//     .assertAll();
//   });
// });