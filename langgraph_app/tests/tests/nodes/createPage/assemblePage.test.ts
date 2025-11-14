// import { describe, it, expect, beforeAll } from 'vitest';
// import { testGraph } from '@support';
// import { DatabaseSnapshotter } from '@services';
// import { routerGraph } from '@graphs';
// import { FileSpecificationModel, CodeTaskModel, WebsiteFileModel } from '@models';
// import { expectCodeMatch } from '@support';

// describe.sequential('PlanPageNode', () => {
//     beforeAll(async () => { 
//       await DatabaseSnapshotter.restoreSnapshot("basic_account");
//     });

//     it('should assemble completed page', async () => {
//         const result = await testGraph()
//             .withGraph(routerGraph)
//             .withPrompt(`Create a website about space exploration`)
//             .stopAfter('assemblePage')
//             .execute();

//         expect(result.error).toBeUndefined();
//         const lastTask = result.state.completedTasks?.[result.state.completedTasks?.length - 1];
//         expect(lastTask?.subtype).toEqual("CREATE_PAGE");
//         expect(lastTask?.results?.code).toBeDefined();
//         expect(lastTask?.results?.dependencies).toBeDefined();
//         expect(lastTask?.results?.summary).toBeDefined();

//         const fileSpec = await FileSpecificationModel.find(lastTask?.fileSpecificationId);
//         expect(fileSpec).toBeDefined();
//         expect(fileSpec?.canonicalPath).toEqual("src/pages/IndexPage.tsx");

//         const savedTask = await CodeTaskModel.find(lastTask?.id);
//         expect(savedTask).toBeDefined();
//         expect(savedTask?.subtype).toEqual("CREATE_PAGE");
//         expect(savedTask?.status).toEqual("COMPLETED");
//         expect(savedTask?.results?.code).toEqual(lastTask?.results?.code);
//         expect(savedTask?.fileSpecificationId).toEqual(fileSpec?.id);
//         expect(savedTask?.createdAt).not.toBeNull();
//         expect(savedTask?.updatedAt).not.toBeNull();

//         const expectedCode = `
//           import { Nav } from "@/src/components/Nav.tsx"
//           import { Hero } from "@/src/components/Hero.tsx"
//           import { Features } from "@/src/components/Features.tsx"
//           import { Benefits } from "@/src/components/Benefits.tsx"
//           import { SocialProof } from "@/src/components/SocialProof.tsx"
//           import { Testimonials } from "@/src/components/Testimonials.tsx"
//           import { CTA } from "@/src/components/CTA.tsx"
//           import { Footer } from "@/src/components/Footer.tsx"

//           export const IndexPage = () => {
//             return (
//               <div id="IndexPage" className="min-h-screen flex flex-col">
//                 <Nav />
//                 <main className="flex-grow">
//                   <Hero />
//                   <Features />
//                   <Benefits />
//                   <SocialProof />
//                   <Testimonials />
//                   <CTA />
//                 </main>
//                 <Footer />
//               </div>
//             );
//           };
//         `;

//         expectCodeMatch(savedTask?.results?.code!, expectedCode);

//         // Verify WebsiteFile is created
//         const websiteId = result.state.website?.id;
//         expect(websiteId).toBeDefined();
        
//         const websiteFile = await WebsiteFileModel.findBy({ 
//             websiteId, 
//             fileSpecificationId: fileSpec?.id 
//         });
//         expect(websiteFile).toBeDefined();
//         expect(websiteFile?.path).toEqual(fileSpec?.canonicalPath);
//         expect(websiteFile?.content).toEqual(lastTask?.results?.code);
//         expect(websiteFile?.fileSpecificationId).toEqual(fileSpec?.id);
        
//         // Verify the CodeTask references the WebsiteFile
//         expect(savedTask?.websiteFileId).toEqual(websiteFile?.id);
//     });
// });