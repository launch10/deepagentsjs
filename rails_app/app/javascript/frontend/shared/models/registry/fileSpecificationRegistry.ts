import { type FileSpecification } from "../fileSpecification";
import { sectionRegistry, sectionTypeSchema } from "./sectionRegistry";
import { configRegistry } from "./configRegistry";
import { styleRegistry } from "./styleRegistry";
import { pageRegistry } from "./pageRegistry";
import { layoutRegistry } from "./layoutRegistry";
import { FileTypeEnum } from "../enums";

export { sectionTypeSchema }

export const fileSpecificationRegistryData: Record<string, FileSpecification> = {
    ...sectionRegistry,
    ...configRegistry,
    ...styleRegistry,
    ...pageRegistry,
    ...layoutRegistry
}

export class FileSpecificationRegistry {
    private readonly registry: Readonly<Record<string, FileSpecification>>;

    /**
     * Creates a new registry instance.
     * @param registryData The combined map of all FileSpecification definitions.
     */
    constructor(registryData: Record<string, FileSpecification>) {
        this.registry = registryData;
    }

    public getAll(): FileSpecification[] {
        return Object.values(this.registry);
    }

    /**
     * Retrieves a FileSpecification by its full unique ID (e.g., "Section:Hero").
     * @param id The unique identifier.
     * @returns The FileSpecification or undefined if not found.
     */
    public getById(id: string): FileSpecification | undefined {
        return this.registry[id];
    }

    /**
     * Retrieves a FileSpecification by its FileType and SubType.
     * Constructs the ID based on the "Type:SubType" convention.
     * @param filetype The FileTypeEnum value.
     * @param subType The string value corresponding to a Subtype enum (e.g., SectionSubtypeEnum.Hero).
     * @returns The FileSpecification or undefined if not found.
     */
    public getByType(
        filetype: FileTypeEnum,
        subType: string // Accept string, caller uses enum value
    ): FileSpecification | undefined {
        const id = `${filetype}:${subType}`;
        return this.registry[id];
    }

    /**
     * Retrieves all FileSpecifications matching a given FileType.
     * @param filetype The FileTypeEnum value.
     * @returns An array of matching FileSpecifications.
     */
    public getAllByType(filetype: FileTypeEnum): FileSpecification[] {
        return Object.values(this.registry).filter(spec => spec.filetype === filetype);
    }

    public getByPath(path: string): FileSpecification | undefined {
        return Object.values(this.registry).find(spec => spec.canonicalPath === path);
    }

    /**
     * Retrieves all FileSpecifications marked as style.
     * @returns An array of style FileSpecifications.
     */
    public getAllStyles(): FileSpecification[] {
        return Object.values(this.registry).filter(spec => spec.filetype === FileTypeEnum.Style);
    }

    public getLayout(): FileSpecification[] {
        return Object.values(this.registry).filter(spec => spec.filetype === FileTypeEnum.Layout);
    }

    /**
     * Helper to directly retrieve the content input Zod schema for a specification.
     * @param idOrType The full ID string or the FileTypeEnum.
     * @param subType If using FileTypeEnum, provide the subtype string.
     * @returns The Zod schema object or undefined if not found or not applicable.
     */
    public getSchema(idOrType: string | FileTypeEnum, subType?: string): z.ZodObject<any> | undefined {
        let spec: FileSpecification | undefined;
        if (typeof idOrType === 'string' && subType === undefined) {
            spec = this.getById(idOrType);
        } else if (typeof idOrType === 'string' && subType !== undefined) {
             // Allow calling like getSchema(FileTypeEnum.Section, SectionSubtypeEnum.Hero)
             spec = this.getByType(idOrType as FileTypeEnum, subType);
        } else {
            // Should not happen with TS if types are correct, but defensive check
             console.warn("Invalid arguments passed to FileSpecificationRegistry.getSchema");
             return undefined;
        }
        return spec?.schema;
    }

    /**
     * Helper to directly retrieve the generation prompt string for a specification.
     * @param idOrType The full ID string or the FileTypeEnum.
     * @param subType If using FileTypeEnum, provide the subtype string.
     * @returns The prompt string or undefined if not found or not applicable.
     */
    public getPrompt(idOrType: string | FileTypeEnum, subType?: string): string | undefined {
         let spec: FileSpecification | undefined;
        if (typeof idOrType === 'string' && subType === undefined) {
            spec = this.getById(idOrType);
        } else if (typeof idOrType === 'string' && subType !== undefined) {
             spec = this.getByType(idOrType as FileTypeEnum, subType);
        } else {
             console.warn("Invalid arguments passed to FileSpecificationRegistry.getPrompt");
             return undefined;
        }
        return spec?.generationPrompt;
    }

    /**
     * Helper to directly retrieve the canonical path for a specification.
     * @param idOrType The full ID string or the FileTypeEnum.
     * @param subType If using FileTypeEnum, provide the subtype string.
     * @returns The canonical path string or undefined if not found.
     */
    public getPath(idOrType: string | FileTypeEnum, subType?: string): string | undefined {
         let spec: FileSpecification | undefined;
        if (typeof idOrType === 'string' && subType === undefined) {
            spec = this.getById(idOrType);
        } else if (typeof idOrType === 'string' && subType !== undefined) {
             spec = this.getByType(idOrType as FileTypeEnum, subType);
        } else {
             console.warn("Invalid arguments passed to FileSpecificationRegistry.getPath");
             return undefined;
        }
        return spec?.canonicalPath;
    }
}

export const fileSpecRegistry = new FileSpecificationRegistry(fileSpecificationRegistryData);