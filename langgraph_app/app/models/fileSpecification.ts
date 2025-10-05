import { z } from "zod";
import { 
    FileTypeEnum, 
    LanguageEnum,
    type FileSpecType, 
    fileSpecSchema,
    Website,
    ComponentTypeEnum,
} from "@types";
import { BaseModel } from "./base";
import { fileSpecifications } from "app/db";
export class FileSpecificationModel extends BaseModel<typeof fileSpecifications, typeof fileSpecSchema> {
    protected static table = fileSpecifications;
    protected static schema = fileSpecSchema;

    id: string;
    description?: string;
    canonicalPath: string;
    filetype: FileTypeEnum;
    componentType: Website.File.SpecificationSubtypeType;
    language: LanguageEnum;
    data: FileSpecType;

    constructor(data: FileSpecType) {
        super(data);
        this.id = data.id;
        this.description = data.description;
        this.canonicalPath = data.canonicalPath;
        this.filetype = data.filetype;
        this.componentType = data.componentType;
        this.language = data.language;
        this.data = data;
    }
    
    get expectedComponentName(): string | undefined {
        const componentTypes = [FileTypeEnum.Page, FileTypeEnum.Section, FileTypeEnum.Layout];
        if (!componentTypes.includes(this.filetype)) return undefined;

        // Browser-compatible path parsing
        const pathParts = this.canonicalPath.split('/');
        const fullFilename = pathParts[pathParts.length - 1];
        const lastDotIndex = fullFilename.lastIndexOf('.');
        const filename = lastDotIndex > -1 ? fullFilename.substring(0, lastDotIndex) : fullFilename;
        
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

    public static sort(fileSpecs: FileSpecType[], by: 'pageOrder'): FileSpecType[] {
        if (by !== 'pageOrder') {
            throw new Error(`Don't know how to sort by ${by}`);
        }

        const nav = fileSpecs.filter(fileSpec => fileSpec.componentType === 'Nav');
        const footer = fileSpecs.filter(fileSpec => fileSpec.componentType === 'Footer');
        const other = fileSpecs.filter(fileSpec => fileSpec.componentType !== 'Nav' && fileSpec.componentType !== 'Footer');

        return [...nav, ...other, ...footer]
    }

    public static isValid(data: unknown): data is FileSpecType {
        return fileSpecSchema.safeParse(data).success;
    }

    public static errors(data: FileSpecType): z.ZodError | undefined {
        const result = fileSpecSchema.safeParse(data);
        return result.success ? undefined : result.error;
    }

    public static getValidationErrors(data: FileSpecType): string[] {
        const errors = this.errors(data);
        if (!errors) return [];
        return errors.issues.map(issue => 
            `${issue.path.join('.')}: ${issue.message}`
        );
    }

    public static validateOrThrow(data: FileSpecType): void {
        if (!FileSpecificationModel.isValid(data)) {
            const errorMessages = this.getValidationErrors(data);
            throw new Error(`Invalid file spec: ${errorMessages.join(', ')}`);
        }
    }
}