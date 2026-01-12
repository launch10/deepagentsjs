export interface File {
    content: string[];
    created_at: string;
    modified_at: string;
}

export type FileMap = Record<string, File>;