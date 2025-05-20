import { z } from "zod";
import { FileTypeEnum, LayoutTypeEnum, ConfigTypeEnum, StyleTypeEnum, LanguageEnum, PageTypeEnum, SectionTypeEnum } from "@shared/models/enums";
import * as path from 'path';

export const fileSpecificationSubtypeSchema = z.union([
    z.nativeEnum(PageTypeEnum),
    z.nativeEnum(SectionTypeEnum),
    z.nativeEnum(StyleTypeEnum),
    z.nativeEnum(LayoutTypeEnum),
    z.nativeEnum(ConfigTypeEnum)
]);

export type FileSpecificationSubtype = z.infer<typeof fileSpecificationSubtypeSchema>;

export const fileSpecificationSchema = z.object({
    id: z.string(),
    canonicalPath: z.string(),
    description: z.string().optional(),
    filetype: z.nativeEnum(FileTypeEnum),
    subtype: fileSpecificationSubtypeSchema,
    schema: z.instanceof(z.ZodObject<any>).optional(),
    generationPrompt: z.function().optional(),
    language: z.nativeEnum(LanguageEnum),
});

export type FileSpecificationData = z.infer<typeof fileSpecificationSchema>;
export class FileSpecification {
    id: string;
    description?: string;
    canonicalPath: string;
    filetype: FileTypeEnum;
    subtype: FileSpecificationSubtype;
    schema?: z.ZodObject<any>;
    generationPrompt?: (state: any) => Promise<string>;
    language: LanguageEnum;

    constructor(data: FileSpecificationData) {
        this.id = data.id;
        this.description = data.description;
        this.canonicalPath = data.canonicalPath;
        this.filetype = data.filetype;
        this.subtype = data.subtype;
        this.schema = data.schema;
        this.generationPrompt = data.generationPrompt;
        this.language = data.language;
    }

    get expectedComponentName(): string | undefined {
        const componentTypes = [FileTypeEnum.Page, FileTypeEnum.Section, FileTypeEnum.Layout];
        if (!componentTypes.includes(this.filetype)) return undefined;

        const filename = path.basename(this.canonicalPath, path.extname(this.canonicalPath));
        // Convert kebab-case or snake_case to PascalCase
        return filename
            .split(/[-_]/)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
    }

    get expectedComponentPath(): string {
        switch (this.filetype) {
            case FileTypeEnum.Page: return `src/pages/${this.expectedComponentName}.tsx`;
            case FileTypeEnum.Section: return `src/components/${this.expectedComponentName}.tsx`;
            case FileTypeEnum.Layout: return `src/components/${this.expectedComponentName}.tsx`;
            default: return this.canonicalPath;
        }
    }

    get languageString(): string {
        switch (this.language) {
            case LanguageEnum.TSX: return 'React/TSX component';
            case LanguageEnum.TS: return 'TypeScript'; 
            case LanguageEnum.CSS: return 'CSS';
            case LanguageEnum.JSON: return 'JSON';
            case LanguageEnum.MD: return 'Markdown';
            default: return 'Unknown language'; 
        }
    }

    get componentTypeString(): string {
        switch (this.filetype) {
            case FileTypeEnum.Page: return 'a single page (e.g. IndexPage, PricingPage)';
            case FileTypeEnum.Section: return 'a single section of a landing page (e.g. Hero, Features, Pricing)';
            case FileTypeEnum.Style: return 'a landing page\'s styles';
            case FileTypeEnum.Layout: return 'an essential layout file (e.g. Nav, Footer, Sidebar)';
            case FileTypeEnum.Config: return 'a configuration file'; 
            default: return 'Unknown file type'; 
        }
    }

    public static create(data: FileSpecificationData): FileSpecification { 
        return new FileSpecification(data);
    }

    public toDataObject(): FileSpecificationData {
        return {
            id: this.id,
            canonicalPath: this.canonicalPath,
            description: this.description,
            filetype: this.filetype,
            subtype: this.subtype,
            schema: this.schema!,
            generationPrompt: this.generationPrompt,
            language: this.language,
        };
    }
}
