// import { describe, it, expect } from 'vitest';
// import { componentOverviewPrompt } from '@prompts';
// import { type ComponentOverviewType } from '@types';
// import { componentOverviewFactory } from '@factories';

// describe.sequential('componentOverview Prompt', () => {
//   it('renders component overview in JSON format', async () => {
//     const componentOverview = await componentOverviewFactory.create();
//     const result = await componentOverviewPrompt({ 
//       overview: componentOverview as ComponentOverviewType 
//     });

//     // Build expected XML - only include name tag if name is not null
//     const expectedXml = ` 
//       <component-overview>
//         <background-color>
//           ${componentOverview.backgroundColor}
//         </background-color>
//         <context>
//           ${componentOverview.context}
//         </context>
//         <copy>
//           ${componentOverview.copy}
//         </copy>
//         ${componentOverview.name !== null ? `<name>${componentOverview.name}</name>` : ''}
//         <purpose>
//           ${componentOverview.purpose}
//         </purpose>
//         <text-color>
//           Suggest a color that contrasts well with the background color, ideally a color from the global brand theme.
//         </text-color>
//       </component-overview>
//     `;
    
//     expect(result).toMatchXml(expectedXml);
//   });
// });