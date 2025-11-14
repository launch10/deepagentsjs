// import { describe, it, expect, beforeAll } from 'vitest';
// import { testGraph } from '@support';
// import { PageTypeEnum } from '@types';
// import { PageModel, CodeTaskModel, ComponentOverviewModel } from '@models';
// import { DatabaseSnapshotter } from '@services';
// import { routerGraph } from '@graphs';

// describe.sequential('PlanPageNode', () => {
//     beforeAll(async () => { 
//         await DatabaseSnapshotter.restoreSnapshot("basic_account");
//     });

//     it('should plan page', async () => {
//         const result = await testGraph()
//             .withGraph(routerGraph)
//             .withPrompt(`Create a website about space exploration`)
//             .stopAfter('planPage')
//             .execute();

//         expect(result.error).toBeUndefined();
//         const indexPage = await PageModel.findBy({websiteId: result.state.website.id, pageType: PageTypeEnum.IndexPage});
//         expect(indexPage).toBeDefined();
//         expect(indexPage.fileSpecificationId).not.toBeNull();
//         expect(indexPage.createdAt).not.toBeNull();
//         expect(indexPage.updatedAt).not.toBeNull();

//         const codeTasks = result.state.queue;
//         const createdCodeTasks = await CodeTaskModel.where({id: codeTasks.map((task) => task.id)})
//         expect(createdCodeTasks).toHaveLength(codeTasks.length);
//         expect(codeTasks.length).toBeGreaterThan(3);

//         const componentOverviews = result.state.componentOverviews;
//         const createdComponentOverviews = await ComponentOverviewModel.where({id: componentOverviews.map((overview) => overview.id)})
//         expect(createdComponentOverviews).toHaveLength(componentOverviews.length);

//         expect(componentOverviews.length).toEqual(codeTasks?.length)
//         createdComponentOverviews.forEach((overview) => {
//             expect(overview.pageId, 'pageId should not be null').not.toBeNull();
//             expect(overview.path, 'path should not be null').not.toBeNull();
//             expect(overview.fileSpecificationId, 'fileSpecificationId should not be null').not.toBeNull();
//         })

//         const uniqueIndexes = new Set(createdComponentOverviews.map((overview) => overview.sortOrder));
//         expect(uniqueIndexes.size, 'sortOrder should be unique').toEqual(createdComponentOverviews.length);
//         createdComponentOverviews.forEach((overview) => {
//             expect(overview.sortOrder, 'sortOrder should not be null').not.toBeNull();
//             expect(overview.createdAt).not.toBeNull();
//             expect(overview.updatedAt).not.toBeNull();
//         });
//     });
// });
