// import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// import { testGraph } from '@support';
// import { CodeTaskModel, FileSpecificationModel, WebsiteFileModel }  from '@models';
// import { DatabaseSnapshotter } from '@services';
// import { routerGraph } from '@graphs';

// describe.sequential('CreateStyles Node', () => {
//     beforeAll(async () => { 
//         await DatabaseSnapshotter.restoreSnapshot("basic_account");
//     });

//     it('should create style files', async () => {
//         const result = await testGraph()
//             .withGraph(routerGraph)
//             .withPrompt(`Create a website about space exploration`)
//             .stopAfter('createStyles')
//             .execute();

//         expect(result.error).toBeUndefined();
//         expect(result.state.completedTasks?.length).toEqual(2);
//         const tasks = result.state.completedTasks;

//         let savedTasks = await CodeTaskModel.where({ id: tasks?.map(t => t.id) })
//         savedTasks = savedTasks.sort((a, b) => a.fileSpecificationId - b.fileSpecificationId)
//         expect(savedTasks.length).toEqual(2);

//         const task1 = savedTasks[0];
//         const fileSpec1 = await FileSpecificationModel.find(task1.fileSpecificationId);
//         expect(fileSpec1?.canonicalPath).toEqual('src/index.css');
//         expect(task1.results?.code).toBeDefined();

//         const task2 = savedTasks[1];
//         const fileSpec2 = await FileSpecificationModel.find(task2.fileSpecificationId);
//         expect(fileSpec2?.canonicalPath).toEqual('tailwind.config.ts');
//         expect(task2.results?.code).toBeDefined();

//         expect(task1.createdAt).not.toBeNull();
//         expect(task1.updatedAt).not.toBeNull();

//         // Verify WebsiteFiles are created for each codeTask
//         const websiteId = result.state.website?.id;
//         expect(websiteId).toBeDefined();

//         // Check WebsiteFile for task1
//         const websiteFile1 = await WebsiteFileModel.findBy({ 
//             websiteId, 
//             fileSpecificationId: task1.fileSpecificationId 
//         });
//         expect(websiteFile1).toBeDefined();
//         expect(websiteFile1.path).toEqual(fileSpec1?.canonicalPath);
//         expect(websiteFile1.content).toEqual(task1.results?.code);
//         expect(websiteFile1.fileSpecificationId).toEqual(task1.fileSpecificationId);

//         // Check WebsiteFile for task2
//         const websiteFile2 = await WebsiteFileModel.findBy({ 
//             websiteId, 
//             fileSpecificationId: task2.fileSpecificationId 
//         });
//         expect(websiteFile2).toBeDefined();
//         expect(websiteFile2.path).toEqual(fileSpec2?.canonicalPath);
//         expect(websiteFile2.content).toEqual(task2.results?.code);
//         expect(websiteFile2.fileSpecificationId).toEqual(task2.fileSpecificationId);
//     });
// });