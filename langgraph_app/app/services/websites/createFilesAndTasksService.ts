import { db, tasks as tasksTable, websiteFiles as websiteFilesTable } from "@db";
import { type CodeTaskType } from "@types";
import { keyBy } from "@utils";

export interface CreateFilesAndTasksInput {
    tasks: CodeTaskType[];
    websiteFiles: {
        websiteId: number;
        fileSpecificationId: number;
        path: string;
        content: string;
    }[];
}

export interface CreateFilesAndTasksOutput {
    completedTasks: CodeTaskType[];
}

export class CreateFilesAndTasksService {
    async execute(input: CreateFilesAndTasksInput): Promise<CreateFilesAndTasksOutput> {
        const { tasks, websiteFiles } = input;

        return await db.transaction(async (tx) => {
            const createdFiles = await tx
                .insert(websiteFilesTable)
                .values(websiteFiles)
                .returning();
            const createdFilesByFileSpecId = keyBy(createdFiles, 'fileSpecificationId');

            const createdTasks = await tx.insert(tasksTable)
                .values(tasks.map((task) => {
                    const createdFile = createdFilesByFileSpecId[task.fileSpecificationId];
                    return {
                        ...task,
                        websiteFileId: createdFile.id,
                    };
                }))
                .onConflictDoNothing()
                .returning();

            return {
                completedTasks: createdTasks
            };
        });
    }
}