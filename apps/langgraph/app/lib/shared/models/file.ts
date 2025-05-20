import { z } from "zod";

export const fileSchema = z.object({
    path: z.string().min(1).describe("File path"),
    content: z.string().describe("Contents of the file"),
    fileSpecificationId: z.number().optional().describe("ID of the file specification"),
});
export type FileData = z.infer<typeof fileSchema>;
export type FileMap = Record<string, FileData>;