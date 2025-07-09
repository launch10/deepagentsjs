import { TemplateSchema, type TemplateData } from "@shared/models/template";
import { FileSpecificationRegistry, fileSpecRegistry } from "@shared/models/registry/fileSpecificationRegistry";
import { type FileData, type FileMap } from "@shared/models/file";
import { type FileSpecification } from "@shared/models/fileSpecification";
import { type AVAILABLE_TEMPLATES, DEFAULT_TEMPLATE_ID, TEMPLATES_REGISTRY } from "@shared/models/template";
import { DirectoryCache } from "@services/directoryCache";
export class Template {
    public static readonly schema = TemplateSchema;
    private static fileSpecRegistry: FileSpecificationRegistry = fileSpecRegistry;

    public readonly id: string;
    public readonly name: string;
    public readonly directoryPath: string;
    public readonly description?: string;

    private readonly styleIds: string[];
    private readonly layoutIds: string[];
    private readonly requiredContextIds: string[];
    public styles: FileSpecification[] | undefined;
    public layouts: FileSpecification[] | undefined;
    public requiredContext: FileSpecification[];

    public files: Record<string, FileData>;
    private cacheDir: string;
    private templatesDir: string;

    constructor(data: TemplateData) {
        this.id = data.id;
        this.name = data.name;
        this.directoryPath = data.directoryPath;
        this.description = data.description;
        this.styleIds = data.styleIds || [];
        this.layoutIds = data.layoutIds || [];
        this.requiredContextIds = data.requiredContextIds || [];
        this.styles = this.getSpecificationsByIds(this.styleIds, 'styles');
        this.layouts = this.getSpecificationsByIds(this.layoutIds, 'layouts');
        this.requiredContext = this.getSpecificationsByIds(this.requiredContextIds, 'requiredContext') || [];
        this.files = (data.files || {}) as Record<string, FileData>;
        this.cacheDir = `${process.cwd()}/.cache/templates`;
        this.templatesDir = `${process.cwd()}/app/templates`;
    }

    path() { 
        return `${this.templatesDir}/${this.directoryPath}`;
    }

    cachePath() {
        return `${this.cacheDir}/${this.directoryPath}`;
    }

    public static async getTemplate(templateId: AVAILABLE_TEMPLATES): Promise<Template> {
        if (templateId === "default") {
            templateId = DEFAULT_TEMPLATE_ID;
        }
        let template = new Template(TEMPLATES_REGISTRY[templateId]);
        let directoryCache = new DirectoryCache(template.path(), template.cachePath());
        let files = await directoryCache.getContents(templateId);
        template.files = files;
        return template;
    }

    /**
     * Validates raw data using the schema and creates a new Template instance.
     * @param data - Raw data to parse and instantiate from.
     * @throws {ZodError} If validation fails.
     */
    public static create(data: unknown): Template {
        const validatedData = this.schema.parse(data); // Use static schema
        return new Template(validatedData); // Call private constructor
    }

    /**
     * Returns a plain JavaScript object snapshot of the template's data state.
     */
    public toDataObject(): TemplateData {
        // Construct the object based on instance properties
        return Template.schema.parse({
            id: this.id,
            name: this.name,
            directoryPath: this.directoryPath,
            description: this.description,
            styleIds: this.styleIds,
            layoutIds: this.layoutIds,
            requiredContextIds: this.requiredContextIds,
            files: this.files
        });
    }

    public async availableComponents(): Promise<string[]> { 
        const components = Object.keys(this.files).filter(key => key.startsWith("src/components/ui")).sort().map(key => key.replace("src", "@"));
        return components;
    }

    public async getPromptContext(): Promise<FileMap> {
        const requiredPaths = this.requiredContext.map((reqSpecModel: FileSpecification) => reqSpecModel.canonicalPath);
        const sortedPaths = requiredPaths
            .filter(path => this.files[path])
            .sort();

        const files: FileMap = {};
        for (const path of sortedPaths) {
            files[path] = { path, content: this.files[path].content };
        }

        return files;
    }

    /**
     * Private helper to get specs from registry (with caching)
     */
    private getSpecificationsByIds(ids: string[], cacheField: 'styles' | 'layouts' | 'requiredContext'): FileSpecification[] {
        if (this[cacheField]) {
            return this[cacheField]!;
        }
        const specs = ids
            .map(id => Template.fileSpecRegistry.getById(id))
            .filter((spec): spec is FileSpecification => {
                return !!spec;
            });
        this[cacheField] = specs;
        return specs;
    }
}