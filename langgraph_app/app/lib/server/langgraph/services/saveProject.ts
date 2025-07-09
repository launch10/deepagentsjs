import { type GraphState } from "@shared/state/graph";
import { baseNode } from "@nodes/core/templates/base";
import { ProjectMode } from "@models/project";
import type { PageData } from "@models/page";
import { db } from "@db"; 
import { project as DbProject, page as DbPage, file as DbFile, section as DbSection } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import * as fs from 'fs';
import * as path from 'path'; // Optional: if you want to resolve path
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Template } from "../models/template";

const saveToDisk = async (state: GraphState) => {
    const cacheDir = path.resolve(process.cwd(), '.cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    const snapshotFilePath = path.join(cacheDir, 'graphStateSnapshot.json');
    try {
        const project = state.app.project;
        const plan = project?.projectPlan;
        // plan: {
        //     tone: plan?.contentStrategy.overallTone,
        //     core_emotional_driver: plan?.contentStrategy.identifiedCoreEmotionalDriver,
        //     attention_grabber: plan?.contentStrategy.attentionGrabber,
        //     problem_statement: plan?.contentStrategy.empathyProblemStatement,
        //     emotional_bridge: plan?.contentStrategy.emotionalBridge,
        //     product_reveal: plan?.contentStrategy.productRevealSolutionPitch,
        //     visual_evocation: plan?.contentStrategy.visualEvocation,
        //     call_to_action: plan?.contentStrategy.callToAction,
        //     page_mood: plan?.contentStrategy.pageMood,
        //     social_proof: plan?.contentStrategy.socialProofAngle,
        //     landing_page_copy: plan?.contentStrategy.synthesizedLandingPageCopy,
        // },
        const output = {
            project: {
                name: state.projectName,
                // thread_id: state.threadId,
                theme_id: project?.themeId,
                files: Object.keys(state.app.files).map(filePath => ({
                    path: filePath,
                    content: state.app.files[filePath].content,
                    file_specification_id: state.app.files[filePath].fileSpecificationId,
                })),
            }
        }
        fs.writeFileSync(snapshotFilePath, JSON.stringify(output, null, 2));
        console.log(`SaveProject: Full state snapshot saved to ${snapshotFilePath}`);
    } catch (error) {
        console.error(`SaveProject: Error saving full state snapshot:`, error);
    }
}

export const updateProject = async (state: GraphState) => {
    debugger;
}

export const createProject = async (state: GraphState, config: LangGraphRunnableConfig): Promise<Partial<GraphState>> => {
    const project = state.app.project;
    const threadId = config.configurable?.thread_id;
    const template = await Template.getTemplate("default");
    const changedFiles = Object.keys(state.app.files).filter(filePath => {
        const file = state.app.files[filePath];
        return !(filePath in template.files) || file.content !== template.files[filePath].content;
    }).map(filePath => ({
        path: filePath,
        content: state.app.files[filePath].content,
        file_specification_id: state.app.files[filePath].fileSpecificationId,
    }));
    const requestJson = {
        project: {
            name: state.projectName,
            thread_id: threadId,
            theme_id: project?.themeId,
            files_attributes: changedFiles,
        }
    }

    const apiUrl = process.env.RAILS_API_URL;

    console.log(`Creating project ${threadId}`)
    if (apiUrl && threadId) {
        fetch(`${apiUrl}/projects/${threadId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${state.jwt}`,
            },
            body: JSON.stringify(requestJson)
        }).catch(error => {
            console.error('Failed to send initial project data to Rails API:', error);
        });
    } else {
        console.warn('RAILS_API_URL is not defined in environment variables. Skipping initial project creation POST request.');
    }

    return {};
}

// export const createProject = async (state: GraphState) => {
//     const { project: projectData, files: filesData } = state.app;

//     if (!projectData) {
//         console.error("SaveProject: No project data found in state.");
//         return;
//     }

//     const tenantId = projectData.tenantId || 0; 
//     const themeId = projectData.themeId || 0; 

//     await saveToDisk(state);
//     await db.transaction(async (tx) => {
//         // 1. Create or update project
//         const projectResult = await tx.insert(DbProject)
//             .values({
//                 projectName: projectData.projectName,
//                 tenantId: tenantId, 
//                 projectMode: projectData.projectMode || ProjectMode.Magic,
//                 projectPlan: projectData.projectPlan || {}, 
//                 themeId: themeId, 
//             })
//             .onConflictDoUpdate({
//                 target: [DbProject.projectName, DbProject.tenantId], 
//                 set: {
//                     projectMode: projectData.projectMode || ProjectMode.Magic,
//                     projectPlan: projectData.projectPlan || {},
//                     themeId: themeId,
//                     updatedAt: new Date(),
//                 }
//             })
//             .returning({ id: DbProject.id });
        
//         const projectId = projectResult[0]?.id;
//         if (!projectId) {
//             console.error("SaveProject: Failed to insert or find project.");
//             throw new Error("Failed to save project");
//         }

//         // 2. Save all files first and create filePath => fileId map
//         const filePathToIdMap = new Map<string, number>();
//         const updatedFiles = state.app.codeTasks?.completedTasks.map((task) => {
//             if (task.filePath && task.success && task.results?.code) {
//                 return task.filePath;
//             }
//             return undefined;
//         }).filter((file): file is string => file !== undefined);
//         const filesToInsert = Object.entries(filesData || {}).filter(([filePath]) => updatedFiles.includes(filePath));
//         const fileUpsertPromises = filesToInsert.map(async ([filePath, fileData]) => {
//             try {
//                 const fileResult = await tx.insert(DbFile)
//                     .values({
//                         projectId: projectId,
//                         path: filePath,
//                         content: fileData.content,
//                         fileSpecificationId: fileData.fileSpecificationId,
//                     })
//                     .onConflictDoUpdate({
//                         target: [DbFile.path, DbFile.projectId],
//                         set: {
//                             content: fileData.content,
//                             fileSpecificationId: fileData.fileSpecificationId,
//                             updatedAt: new Date(),
//                         }
//                     })
//                     .returning({ id: DbFile.id });

//                 if (fileResult[0]?.id) {
//                     filePathToIdMap.set(filePath, fileResult[0].id);
//                     return { filePath, fileId: fileResult[0].id };
//                 } else {
//                     console.error(`SaveProject: Failed to upsert file ${filePath}`);
//                     return { filePath, error: 'db_upsert_failed' };
//                 }
//             } catch (err) {
//                 console.error(`SaveProject: Error upserting file ${filePath}:`, err);
//                 return { filePath, error: 'exception' };
//             }
//         });

//         await Promise.all(fileUpsertPromises);

//         // 3. Process pages using the filePathToIdMap
//         for (const pageDataItem of projectData.pages || []) {
//             const pageFilePath = pageDataItem.filePath;
//             const pageFileId = pageFilePath ? filePathToIdMap.get(pageFilePath) : undefined;

//             if (pageFilePath && !pageFileId) {
//                 console.error(`SaveProject: No file ID found for page ${pageFilePath}`);
//                 continue;
//             }
//             if (!pageFilePath && !pageFileId) {
//                 // This case means the page doesn't have an associated file path.
//                 // If DbPage requires fileId to be notNull, this will fail unless fileId handling is adjusted
//                 // For now, we assume if pageFilePath is null/undefined, pageFileId will also be undefined.
//                 // The DbPage schema has fileId as notNull. This implies a page MUST have a file.
//                 // If pages can exist without files, schema for DbPage.fileId needs to be nullable or handle this.
//                 console.warn(`SaveProject: Page ${pageDataItem.subtype} does not have a filePath. A fileId is required by DbPage schema.`);
//                 // To proceed, we MUST have a valid fileId or change schema. For now, let's skip such pages.
//                 // A placeholder file could be created, or the schema could be adapted.
//                 // For now, we will enforce that a page must have a file to be saved.
//                 if (!pageFileId) {
//                     console.error(`SaveProject: Skipping page ${pageDataItem.subtype} as it requires a fileId which could not be determined.`);
//                     continue;
//                 }
//             }

//             const pageName = pageDataItem.subtype || (pageFilePath ? pageFilePath.split('/').pop()?.split('.')[0] : undefined) || 'Untitled Page';
//             const pageResult = await tx.insert(DbPage)
//                 .values({
//                     name: pageName, 
//                     projectId: projectId,
//                     pageType: pageDataItem.subtype, 
//                     contentPlan: pageDataItem.plan || {}, 
//                     fileId: pageFileId!, // Assert non-null: previous checks should ensure fileId is set if pageFilePath existed
//                 })
//                 .onConflictDoUpdate({
//                     target: [DbPage.projectId, DbPage.pageType], // Unique constraint on (projectId, pageType)
//                     set: {
//                         name: pageName,
//                         pageType: pageDataItem.subtype,
//                         contentPlan: pageDataItem.plan || {},
//                         fileId: pageFileId!,
//                         updatedAt: new Date(),
//                     }
//                 })
//                 .returning({ id: DbPage.id });
//             const pageId = pageResult[0]?.id;
//             if (!pageId) {
//                 console.error(`SaveProject: Failed to upsert page ${pageName}`);
//                 continue; 
//             }

//             // --- Start of Bulk Section Processing ---
//             const sectionsToInsert: any[] = [];
//             const sectionFilePaths = pageDataItem.sections?.map(section => section.file.path);
//             const sectionDataWithFileIds = new Map<number, { sectionDataItem: any; fileId?: number; error?: string }>();
            
//             // Map sections to their file IDs using the filePathToIdMap
//             sectionFilePaths?.forEach((filePath, index) => {
//                 const fileId = filePathToIdMap.get(filePath);
//                 if (pageDataItem.sections && pageDataItem.sections[index]) {
//                     sectionDataWithFileIds.set(index, {
//                         sectionDataItem: pageDataItem.sections[index],
//                         fileId,
//                         error: !fileId ? 'file_not_found' : undefined
//                     });
//                 }
//             });

//             (pageDataItem.sections || []).forEach((sectionDataItem, index) => {
//                 const fileOpResult = sectionDataWithFileIds.get(index);
                
//                 // Get name and componentId from contentPlan.overview, with fallbacks
//                 const name = sectionDataItem.contentPlan?.overview?.name || sectionDataItem.contentPlan?.overview?.componentId || 'Unnamed Section';
//                 const componentId = sectionDataItem.contentPlan?.overview?.componentId || name.replace(/\s+/g, '') || `section-${pageId}-${index}`; 

//                 if (!fileOpResult || !fileOpResult.fileId) {
//                      console.warn(`SaveProject: Skipping section '${name}' (componentId: ${componentId}, page: ${pageName}) due to file processing error: ${fileOpResult?.error || 'unknown'}. A fileId is required.`);
//                      return; // Skip this section if fileId couldn't be obtained and is required
//                 }
                
//                 const { fileId } = fileOpResult;

//                 sectionsToInsert.push({
//                     pageId: pageId,
//                     name: name,
//                     componentId: componentId,
//                     sectionType: sectionDataItem.sectionType, // Directly from sectionDataItem
//                     fileId: fileId, 
//                     contentPlan: sectionDataItem.contentPlan || {},
//                     theme: sectionDataItem.theme, // Directly from sectionDataItem
//                 });
//             });

//             if (sectionsToInsert.length > 0) {
//                 await tx.insert(DbSection)
//                     .values(sectionsToInsert)
//                     .onConflictDoUpdate({
//                         // IMPORTANT: A unique constraint on (page_id, component_id) or (page_id, order) MUST exist in db/schema/section.ts
//                         // Using (page_id, component_id) as an example.
//                         target: [DbSection.pageId, DbSection.componentId], 
//                         set: {
//                             name: sql`excluded.name`,
//                             sectionType: sql`excluded.section_type`,
//                             pageId: sql`excluded.page_id`,
//                             componentId: sql`excluded.component_id`,
//                             fileId: sql`excluded.file_id`,
//                             contentPlan: sql`excluded.content_plan`,
//                             theme: sql`excluded.theme`,
//                             updatedAt: new Date(),
//                         }
//                     });
//             }

//         }
//     });
//     console.log("SaveProject: Project, pages, and sections saved successfully.");
// };