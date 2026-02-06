import { codeFiles, db, eq } from "@db";
import { writeFile, mkdir, rm } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { getLogger } from "@core";

/**
 * Exports website files from database to an isolated directory
 */
export class FileExporter implements AsyncDisposable {
  private websiteId: number;
  private outputDir: string;

  constructor(websiteId: number, outputDir?: string) {
    this.websiteId = websiteId;
    this.outputDir = outputDir || join(tmpdir(), `website-test-${websiteId}-${Date.now()}`);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    try {
      // Add a small delay to ensure processes have released files
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Try to remove the directory with retries
      let retries = 3;
      while (retries > 0) {
        try {
          await rm(this.outputDir, {
            recursive: true,
            force: true,
            maxRetries: 3,
            retryDelay: 100,
          });
          break;
        } catch (err: any) {
          retries--;
          if (retries === 0) {
            getLogger({ component: "FileExporter" }).warn({ outputDir: this.outputDir, err }, "Could not fully clean up output directory");
            // Don't throw - we don't want cleanup failures to break tests
          } else {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }
    } catch (err) {
      getLogger({ component: "FileExporter" }).warn({ outputDir: this.outputDir, err }, "Error during cleanup");
    }
  }

  /**
   * Export all files for a website to the output directory
   */
  async export(): Promise<string> {
    const log = getLogger({ component: "FileExporter" });
    log.info({ websiteId: this.websiteId, outputDir: this.outputDir }, "Exporting website files");

    // Get all files for this website
    const files = await db.select().from(codeFiles).where(eq(codeFiles.websiteId, this.websiteId));

    if (files.length === 0) {
      throw new Error(`No files found for website ${this.websiteId}`);
    }

    // Create output directory if it doesn't exist
    if (!existsSync(this.outputDir)) {
      await mkdir(this.outputDir, { recursive: true });
    }

    // Write each file to the output directory
    for (const file of files) {
      const filePath = join(this.outputDir, file.path!);
      const fileDir = dirname(filePath);

      // Create directory structure if needed
      if (!existsSync(fileDir)) {
        await mkdir(fileDir, { recursive: true });
      }

      // Write file content
      await writeFile(filePath, file.content || "");
      log.debug({ filePath: file.path }, "Exported file");
    }

    log.info({ fileCount: files.length, outputDir: this.outputDir }, "Export complete");
    return this.outputDir;
  }

  /**
   * Get the output directory path
   */
  getOutputDir(): string {
    return this.outputDir;
  }
}
