import { BaseModel } from "./base";
import { websiteFileSchema } from "@types";
import { websiteFiles as websiteFilesTable } from "app/db";

// A "WebsiteFile" is distinguished from a "TemplateFile":
//
// TemplateFile: Boilerplate — A file that is part of the template. Aka a default package.json, or tsconfig.json
// WebsiteFile: User-Modified — A modified template file, or new page. Aka a user-modified package.json, or components/Hero.tsx, or pages/IndexPage.tsx
//
// "CodeFile" is a view that represents ALL files for a given website, whether they've been modified or not. 
// You should use WebsiteFile when you need to update user-modified files, and CodeFile for reading/querying files with full text search.
export class WebsiteFileModel extends BaseModel<typeof websiteFilesTable, typeof websiteFileSchema> {
  protected static table = websiteFilesTable;
  protected static schema = websiteFileSchema;
}