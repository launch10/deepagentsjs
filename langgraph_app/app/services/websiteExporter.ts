import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { db, codeFiles, websites, eq } from "@db";
import { getLogger } from "@core";
import _ from "lodash";

const log = getLogger({ component: "WebsiteExporter" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXAMPLES_DIR = path.resolve(__dirname, "../../../shared/websites/examples");

export interface ExportWebsiteOptions {
  websiteId: number;
  /** Custom name for the export directory. Defaults to snake_case website name */
  name?: string;
  /** Overwrite existing directory if it exists. Default: false */
  overwrite?: boolean;
}

export interface ExportResult {
  exportPath: string;
  fileCount: number;
  files: string[];
}

/**
 * Exports website files from the database to the shared/websites/examples directory.
 *
 * Usage:
 *   await WebsiteExporter.export({ websiteId: 123 });
 *   await WebsiteExporter.export({ websiteId: 123, name: "my-project" });
 */
export class WebsiteExporter {
  static async export(options: ExportWebsiteOptions): Promise<ExportResult> {
    const { websiteId, overwrite = false } = options;

    // Get website info
    const [website] = await db
      .select()
      .from(websites)
      .where(eq(websites.id, websiteId))
      .limit(1);

    if (!website) {
      throw new Error(`Website ${websiteId} not found`);
    }

    const exportName = options.name || _.snakeCase(website.name || `website_${websiteId}`);
    const exportPath = path.join(EXAMPLES_DIR, exportName);

    // Check if directory exists
    try {
      await fs.access(exportPath);
      if (!overwrite) {
        throw new Error(
          `Export directory already exists: ${exportPath}. Use overwrite: true to replace.`
        );
      }
      // Remove existing directory
      await fs.rm(exportPath, { recursive: true, force: true });
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
      // Directory doesn't exist, that's fine
    }

    // Get all files for this website
    const files = await db
      .select({
        path: codeFiles.path,
        content: codeFiles.content,
      })
      .from(codeFiles)
      .where(eq(codeFiles.websiteId, websiteId));

    if (files.length === 0) {
      throw new Error(`No files found for website ${websiteId}`);
    }

    // Write files to export directory
    const writtenFiles: string[] = [];

    for (const file of files) {
      if (!file.path || file.content === null) continue;

      const filePath = path.join(exportPath, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
      writtenFiles.push(file.path);
    }

    log.info({ fileCount: writtenFiles.length, exportPath }, "Exported website files");

    return {
      exportPath,
      fileCount: writtenFiles.length,
      files: writtenFiles,
    };
  }

  /**
   * List all exported examples
   */
  static async list(): Promise<string[]> {
    try {
      const entries = await fs.readdir(EXAMPLES_DIR, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }
}
