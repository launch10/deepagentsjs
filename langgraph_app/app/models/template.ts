import { templateSchema, type TemplateFileType } from "@types";
import { BaseModel } from "./base";
import { templates, templateFiles, db, eq, asc, ilike, and  } from "app/db";
export class TemplateModel extends BaseModel<typeof templates, typeof templateSchema> {
    protected static table = templates;
    protected static schema = templateSchema;

    public static async getTemplate(templateKey: string = "default"): Promise<TemplateModel> {
        let templateData = (await db.select().from(templates).where(eq(templates.name, templateKey))).at(0);
        if (!templateData) {
            throw new Error(`Template not found for name: ${templateKey}`);
        }
        templateSchema.parse(templateData) // validate data
        return new TemplateModel(templateData);
    }

    public async files(): Promise<TemplateFileType[]> {
        const tf = await db
                .select()
                .from(templateFiles)
                .where(
                    eq(templateFiles.templateId, this.data.id)
                )

        return tf as TemplateFileType[];
    }

    public async availableShadCnComponents(): Promise<string[]> { 
        let query = db
                .select({ path: templateFiles.path }).from(templateFiles)
                .where(
                    and(
                        eq(templateFiles.templateId, this.data.id),
                        ilike(templateFiles.path, "src/components/ui/%")
                    )
                )
                .orderBy(asc(templateFiles.path));
        let components = await query;
        return components.map(component => component.path!.replace("src", "@"));
    }
}