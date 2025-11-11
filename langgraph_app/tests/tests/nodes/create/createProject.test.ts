// import { describe, it, expect, beforeAll } from 'vitest';
// import { testGraph } from '@support';
// import { lastAIMessage } from '@annotation';
// import { DatabaseSnapshotter } from '@services';
// import { routerGraph } from '@graphs';
// import { startPolly } from '@utils';

// // TODO: Switch to brainstorming flow!!!
// describe.sequential('CreateProject Node with Mocked API', () => {
//     beforeAll(async () => {
//         await DatabaseSnapshotter.restoreSnapshot("basic_account");
//     })

//     describe("When Rails API responds successfully", () => {
//         it.only('should save initial project with mocked API', async () => {
//             // Expected flow:
//             // 1) Calls LLM directly to name project -> LLM provides projectName
//             // 2) Calls Rails API to create project with the provided name -> Rails returns project with id
//             // 3) Stops for us to test graph state
//             //
//             // Requires that we are successfully mocking Rails API + LLM calls separately and reliably
//             const result = await testGraph()
//                 .withGraph(routerGraph)
//                 .withPrompt(`Create a website about space exploration`)
//                 .stopAfter('createProject')
//                 .execute();

//             expect(result.error).toBeUndefined();
//             expect(result.state.projectName).toBeDefined();
//             expect(result.state.project?.id).toBeGreaterThan(0);
//             expect(result.state.project?.name).toEqual(result.state.projectName);

//             expect(result.state.project?.threadId).toBeDefined();

//             const aiResponse = lastAIMessage(result.state);
//             expect(aiResponse?.content).toContain(`Space Exploration Landing Page`)

//             expect(result.state.project.createdAt).toBeDefined();
//             expect(result.state.project.updatedAt).toBeDefined();

//             expect(result.state.website.createdAt).toBeDefined();
//             expect(result.state.website.updatedAt).toBeDefined();
//         });

//         it('should handle multiple API calls in sequence', async () => {
//             // All API calls within this test will be recorded/replayed
//             const result = await testGraph()
//                 .withGraph(routerGraph)
//                 .withPrompt("Create an e-commerce platform with user authentication")
//                 .stopAfter('createProject')
//                 .execute();

//             expect(result.error).toBeUndefined();
//             expect(result.state.projectName).toEqual("shop-auth");
//             expect(result.state.project?.id).toBeGreaterThan(0);
//         });
//     });

//     describe("When Rails API fails", () => {
//         it('should handle Rails API failure', async () => {
//             const polly = await startPolly();
//             polly.server.any('localhost:3000/projects', (req, res) => {
//                 res.status(500).json({ error: "Failed to create project" });
//             });
            
//             const result = await testGraph()
//                 .withGraph(routerGraph)
//                 .withPrompt("Create an e-commerce platform with user authentication")
//                 .stopAfter('createProject')
//                 .execute();

//             expect(result.state.error).toBeDefined();
//             expect(result.state.error?.message).toEqual("Failed to create project");
//         });
//     });
// });