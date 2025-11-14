// import { describe, it, expect, beforeAll, vi } from 'vitest';
// import { testGraph } from '@support';
// import { DatabaseSnapshotter } from '@utils';
// import { CodeTaskModel, ComponentModel, ComponentContentPlanModel, ComponentOverviewModel, WebsiteFileModel } from '@models';

// describe.sequential('CreateComponentNode', () => {
//     beforeAll(async () => { 
//         await DatabaseSnapshotter.restoreSnapshot("basic_account");
//     });

//     it('creates planned component', async () => {
//         // We put this down here because we need to mock the PlanPageService
//         const { routerGraph } = await import('@graphs');

//         const result = await testGraph()
//             .withGraph(routerGraph)
//             .withPrompt(`Create a website about space exploration`)
//             .stopAfter('createComponent')
//             .execute();

//         expect(result.error).toBeUndefined();
//         const task = result.state.task;
//         expect(task?.results.code).toBeDefined();
//         expect(task?.results?.summary).toBeDefined();
//         expect(task?.status).toEqual("COMPLETED");
//         expect(task.componentId).not.toBeNull();

//         const persistedTask = await CodeTaskModel.find(task?.id);
//         expect(persistedTask?.results.code).toEqual(task?.results?.code);
//         expect(persistedTask?.results?.summary).toEqual(task?.results?.summary);
//         expect(persistedTask?.status).toEqual(task?.status);

//         const component = await ComponentModel.find(task?.componentId);
//         const componentContentPlan = await ComponentContentPlanModel.findBy({componentOverviewId: task?.componentOverviewId});
//         const componentOverview = await ComponentOverviewModel.findBy({id: task?.componentOverviewId});

//         expect(component?.componentType).toEqual(task?.componentType);
//         expect(component.componentOverviewId).toEqual(task?.componentOverviewId)
//         expect(component.componentType).toEqual(task?.componentType)
//         expect(component.componentContentPlanId).toEqual(componentContentPlan?.id)

//         const websiteFile = await WebsiteFileModel.find(component.websiteFileId);
//         expect(websiteFile).not.toBeNull();
//         expect(websiteFile?.content).toEqual(task?.results?.code);
//         expect(websiteFile?.path).toEqual(component.path);

//         expect(componentContentPlan?.componentId).toEqual(component.id);
//         expect(componentOverview.componentId).toEqual(component.id);
//         expect(component.websiteFileId).toEqual(websiteFile?.id);
        
//         expect(persistedTask?.createdAt).not.toBeNull();
//         expect(persistedTask?.updatedAt).not.toBeNull();
//         expect(component.createdAt).not.toBeNull();
//         expect(component.updatedAt).not.toBeNull();
//         expect(componentContentPlan?.createdAt).not.toBeNull();
//         expect(componentContentPlan?.updatedAt).not.toBeNull();
//         expect(componentOverview.createdAt).not.toBeNull();
//         expect(componentOverview.updatedAt).not.toBeNull();
//         expect(websiteFile?.createdAt).not.toBeNull();
//         expect(websiteFile?.updatedAt).not.toBeNull();
//     });
// });