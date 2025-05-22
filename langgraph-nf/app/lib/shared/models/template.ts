import { z } from "zod";

export const TemplateSchema = z.object({
    id: z.string().describe("Unique ID for the template"),
    name: z.string().describe("Name of the template"),
    directoryPath: z.string().describe("Path to the template directory"),
    description: z.string().optional().describe("Description of the template"),
    styleIds: z.array(z.string()).describe("List of style files for the template"),
    layoutIds: z.array(z.string()).describe("List of layout files for the template"),
    requiredContextIds: z.array(z.string()).describe("List of critical files for the template, used for prompt context"),
    files: z.record(z.string(), z.object({ path: z.string(), content: z.string() })).optional().describe("Files in the template directory")
});
export type TemplateData = z.infer<typeof TemplateSchema>;

const DEFAULT_TEMPLATE: TemplateData = {
    id: "vite_react_shadcn",
    name: "Vite + React + Shadcn",
    description: "Default template",
    directoryPath: "vite_react_shadcn",
    styleIds: [
        "Style:IndexCss", 
        "Style:TailwindConfig", 
    ],
    layoutIds: [
        "Layout:Nav",
        "Layout:Footer"
    ],
    requiredContextIds: [
        "Config:PackageJson",
        "Style:TailwindConfig",
        "Style:IndexCss"
    ]
};
export const TEMPLATES_REGISTRY: Record<string, TemplateData> = {
    "vite_react_shadcn": DEFAULT_TEMPLATE
};

export const DEFAULT_TEMPLATE_ID = "vite_react_shadcn";
export type AVAILABLE_TEMPLATES = keyof typeof TEMPLATES_REGISTRY;