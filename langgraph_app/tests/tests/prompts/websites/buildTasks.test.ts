// import { describe, it, expect } from 'vitest';
// import { buildTasksPrompt } from '@prompts';
// import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// describe.skip.sequential('buildTasks Prompt', () => {
//   it('should render with example inputs and correct structure', async () => {
//     const userRequest = "Add a testimonials section to the homepage";
//     const messages = [
//       new HumanMessage(userRequest)
//     ];
    
//     const result = await buildTasksPrompt({
//       messages,
//       consoleError: undefined
//     });

//     expect(result).toMatchXml(`
//       <role>
//         You are an expert AI software engineering manager.
//     `);

//     expect(result).toMatchXml(`
//       <task>
//         Your goal is to decompose a user's request into a set of tasks
//     `);

//     expect(result).toMatchXml(`
//       <user-request>
//         ${userRequest}
//       </user-request>
//     `);

//     expect(result).toMatchXml(`
//       <task-types>
//     `);

//     expect(result).toMatchXml(`
//       CREATE_COMPONENT
//     `);

//     expect(result).toMatchXml(`
//       <component-types>
//         <component type="Hero">
//           Choose when the user wants a prominent header section at the top of the page. Ideal for main headlines, value propositions, and primary call-to-action buttons. Also appropriate for 'above the fold', 'header', or 'banner' requests.
//         </component>
//         <component type="Benefits">
//           Choose when the user wants to highlight advantages, key features, or value propositions. Good for 'why choose us', 'advantages', 'key points', or 'what you get' sections.
//         </component>
//         <component type="CTA">
//           Choose for call-to-action sections that drive user engagement. Ideal for 'sign up', 'get started', 'contact us', or any conversion-focused section that prompts immediate action.
//         </component>
//         <component type="Custom">
//           Choose when the user's request doesn't fit any other predefined section types or requires highly specialized, unique functionality.
//         </component>
//         <component type="FAQ">
//           Choose when the user wants to address common questions, concerns, or provide help information. Good for 'frequently asked questions', 'help', 'support', or 'common questions' sections.
//         </component>
//         <component type="Features">
//           Choose when the user wants to showcase specific product or service features, capabilities, or functionalities. Good for 'what we offer', 'capabilities', or detailed product/service breakdowns.
//         </component>
//         <component type="HowItWorks">
//           Choose when the user wants to explain processes, steps, or workflows. Ideal for 'process', 'steps', 'how to use', or any section explaining sequential information.
//         </component>
//         <component type="Testimonials">
//           Choose when the user wants to showcase customer reviews, feedback, or endorsements. Good for 'reviews', 'what people say', 'client feedback', or 'endorsements' sections.
//         </component>
//         <component type="Team">
//           Choose when the user wants to showcase team members, leadership, or staff. Good for 'about the team', 'our experts', 'leadership', or 'meet the team' sections.
//         </component>
//         <component type="Pricing">
//           Choose when the user wants to display pricing information, plans, or packages. Good for 'plans', 'packages', 'subscriptions', or any price-related comparison sections.
//         </component>
//         <component type="SocialProof">
//           Choose when the user wants to display trust indicators like logos, statistics, or achievements. Good for 'trusted by', 'as seen in', 'achievements', or sections showing company/client logos.
//         </component>
//       </component-types>
//     `);
//   });

//   it('should include console error when provided', async () => {
//     const userRequest = "Fix the broken navbar";
//     const consoleError = "TypeError: Cannot read property 'map' of undefined";
//     const messages = [
//       new HumanMessage(userRequest)
//     ];

//     const result = await buildTasksPrompt({
//       messages,
//       consoleError
//     });

//     expect(result).toMatchXml(`
//       <console-error>
//         ${consoleError}
//       </console-error>
//     `);
//   });

//   it('errors when messages array is empty', async () => {
//     await expect(buildTasksPrompt({
//       messages: [],
//       consoleError: undefined
//     })).rejects.toThrow('userRequest is required');
//   });

//   it('errors when no human message in messages', async () => {
//     await expect(buildTasksPrompt({
//       messages: [new SystemMessage("test")],
//       consoleError: undefined
//     })).rejects.toThrow('userRequest is required');
//   });

//   it('errors when human message has no content', async () => {
//     await expect(buildTasksPrompt({
//       messages: [new HumanMessage("")],
//       consoleError: undefined
//     })).rejects.toThrow('userInput is required');
//   });

// });