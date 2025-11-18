// import { describe, it, expect, beforeAll } from 'vitest';
// import { createComponentInstructionsPrompt } from '@prompts';
// import { type FileSpecType, type CodeTaskType } from '@types';
// import { fileSpecFactory, createComponentCodeTaskFactory } from '@factories';
// import { ComponentOverviewModel } from '@models';

// // By the time we have CreateComponentInstructions, we have planned our component. 
// describe.sequential('CreateComponentInstructions Prompt', () => {
//   let heroSpec: FileSpecType;
//   let mockCodeTask: CodeTaskType;
//   beforeAll(async () => {
//     heroSpec = await fileSpecFactory.create({ componentType: 'Hero' });
//     const data = await createComponentCodeTaskFactory.create({componentType: 'Hero'});
//     mockCodeTask = data.task;
//   });

//   it('renders instructions based on file spec', async () => {
//     const result = await createComponentInstructionsPrompt({ task: mockCodeTask, fileSpec: heroSpec });

//     expect(result).toMatchCode(`
//         **Component Name:** Create a component named: HeroBanner. Give the component an ID of HeroBanner, so that it can be used as an anchor for links.
//     `);
//     expect(result).toMatchCode(`
//         **Use Named Export:** Export the component as HeroBanner. DO NOT USE default export.
//     `);
//   });

//   it('renders different instructions based on different file spec', async () => {
//     const featuresSpec = await fileSpecFactory.create({ componentType: 'Features' });
//     const data = await createComponentCodeTaskFactory.create({componentType: 'Features'});
//     const featuresTask = data.task;
    
//     // Update the component overview name to custom naming
//     await ComponentOverviewModel.update(data.componentOverview.id, { name: 'FeaturesSectionzzz' });

//     const result = await createComponentInstructionsPrompt({ task: featuresTask, fileSpec: featuresSpec });

//     expect(result).toMatchXml(`
//         **Component Name:** Create a component named: FeaturesSectionzzz. Give the component an ID of FeaturesSectionzzz, so that it can be used as an anchor for links.
//     `);
//     expect(result).toMatchXml(`
//         **Use Named Export:** Export the component as FeaturesSectionzzz. DO NOT USE default export.
//     `);
//   });

//   it('errors on invalid file spec', async () => {
//     await expect(async () => {
//       // @ts-expect-error - Testing missing required prop
//       await createComponentInstructionsPrompt({} as any);
//     }).rejects.toThrow('fileSpec is required');
//   });

//   it('errors on invalid file spec', async () => {
//     await expect(async () => {
//       // @ts-expect-error - Testing missing required prop
//       await createComponentInstructionsPrompt({ fileSpec: {bingos: 'bingos'} as any });
//     }).rejects.toThrow('Invalid file spec');
//   });
// });