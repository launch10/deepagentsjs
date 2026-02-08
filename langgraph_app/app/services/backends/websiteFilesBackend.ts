import type {
  BackendProtocol,
  EditResult,
  FileData,
  FileInfo,
  FileUploadResponse,
  FileDownloadResponse,
  GrepMatch,
  WriteResult,
} from "deepagents";
import { FilesystemBackend } from "deepagents";
import {
  db,
  codeFiles,
  templateFiles,
  websites,
  eq,
  and,
  sql,
  Types as DBTypes,
  type DB,
} from "@db";
import * as fs from "fs/promises";
import * as path from "path";
import _ from "lodash";
import micromatch from "micromatch";
import { WebsiteFilesAPIService } from "@rails_api";
import { appendFileSync } from "fs";
import { getLogger } from "@core";

// Debug file logger for tracing read/write/edit operations
const DEBUG_LOG_PATH = "/tmp/website_files_backend.log";

function debugLog(
  websiteId: number | undefined,
  operation: string,
  details: Record<string, unknown>
) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      websiteId,
      operation,
      ...details,
    };
    appendFileSync(DEBUG_LOG_PATH, JSON.stringify(logEntry) + "\n");
  } catch (e) {
    // Ignore logging errors
  }
}

export interface CreateBackendParams {
  website: DBTypes.WebsiteType;
  jwt: string;
}

export class WebsiteFilesBackend implements BackendProtocol {
  private fs: FilesystemBackend;
  private website: DBTypes.WebsiteType;
  private database: DB;
  private rootDir: string;
  private jwt: string;
  private dirtyPaths: Set<string> = new Set();

  constructor(config: CreateBackendParams) {
    this.website = config.website;
    this.rootDir = this.makeRootDir();
    this.fs = new FilesystemBackend({
      rootDir: this.rootDir,
      virtualMode: true,
    });
    this.database = db;
    this.jwt = config.jwt;
  }

  makeRootDir(): string {
    const name = _.snakeCase(this.website.name ?? "");
    return `agents/websites/${this.website.accountId}/${name}`;
  }

  static async create(params: CreateBackendParams): Promise<WebsiteFilesBackend> {
    const backend = new WebsiteFilesBackend(params);
    await backend.hydrate();
    return backend;
  }

  getRootDir(): string {
    return this.rootDir;
  }

  getWebsiteId(): number {
    if (!this.website.id) {
      throw new Error("Website ID is undefined");
    }
    return this.website.id;
  }

  async hydrate(): Promise<void> {
    debugLog(this.website.id, "HYDRATE_START", { rootDir: this.rootDir });

    let files = await this.database
      .select({
        path: codeFiles.path,
        content: codeFiles.content,
      })
      .from(codeFiles)
      .where(eq(codeFiles.websiteId, this.getWebsiteId()));

    // Fall back to template files if no code files exist yet (create flow)
    if (files.length === 0 && this.website.templateId) {
      debugLog(this.website.id, "HYDRATE_FALLING_BACK_TO_TEMPLATE", {
        templateId: this.website.templateId,
      });
      files = await this.database
        .select({
          path: templateFiles.path,
          content: templateFiles.content,
        })
        .from(templateFiles)
        .where(eq(templateFiles.templateId, this.website.templateId));
    }

    debugLog(this.website.id, "HYDRATE_FILES_LOADED", {
      fileCount: files.length,
      paths: files.map((f) => f.path),
    });

    await this.cleanup();

    for (const file of files) {
      if (!file.path || !file.content) continue;

      const filePath = path.join(this.rootDir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }

    debugLog(this.website.id, "HYDRATE_COMPLETE", { fileCount: files.length });
  }

  async cleanup(): Promise<void> {
    await fs.rm(this.rootDir, { recursive: true, force: true });
  }

  async lsInfo(path: string): Promise<FileInfo[]> {
    getLogger({ component: "WebsiteFilesBackend" }).debug({ path }, "lsInfo");
    return this.fs.lsInfo(path);
  }

  async read(filePath: string, offset: number = 0, limit: number = 2000): Promise<string> {
    getLogger({ component: "WebsiteFilesBackend" }).debug({ filePath, offset, limit }, "read");

    // Return raw content without line numbers to avoid confusing the agent
    // The default fs.read() adds line numbers which can cause issues when
    // agents try to match content for edits or writes
    let fileData;
    try {
      fileData = await this.fs.readRaw(filePath);
    } catch (e) {
      // readRaw throws on missing files/directories — return error string
      // instead of crashing the graph (matches deepagents' read() behavior)
      const msg = e instanceof Error ? e.message : String(e);
      debugLog(this.website.id, "READ_ERROR", { filePath, error: msg });
      return `Error: ${msg}`;
    }
    const rawContent = Array.isArray(fileData.content)
      ? fileData.content.join("\n")
      : String(fileData.content);

    // Apply offset and limit (in lines)
    const lines = rawContent.split("\n");
    const startIdx = offset;
    const endIdx = Math.min(startIdx + limit, lines.length);

    if (startIdx >= lines.length) {
      return `Error: Line offset ${offset} exceeds file length (${lines.length} lines)`;
    }

    const content = lines.slice(startIdx, endIdx).join("\n");

    debugLog(this.website.id, "READ", {
      filePath,
      offset,
      limit,
      contentLength: content.length,
      contentHash: Buffer.from(content).toString("base64").slice(0, 20),
      contentPreview: content.slice(0, 200).replace(/\n/g, "\\n"),
    });
    return content;
  }

  async readRaw(filePath: string): Promise<FileData> {
    getLogger({ component: "WebsiteFilesBackend" }).debug({ filePath }, "readRaw");
    return this.fs.readRaw(filePath);
  }

  async globInfo(pattern: string, path: string = "/"): Promise<FileInfo[]> {
    getLogger({ component: "WebsiteFilesBackend" }).debug({ pattern, path }, "globInfo");
    return this.fs.globInfo(pattern, path);
  }

  async grepRaw(
    pattern: string,
    pathPrefix: string = "/",
    glob: string | null = null
  ): Promise<GrepMatch[] | string> {
    getLogger({ component: "WebsiteFilesBackend" }).debug({ pattern, pathPrefix, glob }, "grepRaw");
    try {
      const regex = new RegExp(pattern);
      const tsQuery = this.regexToTsQuery(pattern);

      const results = await this.database
        .select({
          path: codeFiles.path,
          content: codeFiles.content,
          rank: sql<number>`ts_rank(content_tsv, to_tsquery('english', ${tsQuery}))`.as("rank"),
        })
        .from(codeFiles)
        .where(
          and(
            eq(codeFiles.websiteId, this.getWebsiteId()),
            sql`content_tsv @@ to_tsquery('english', ${tsQuery})`
          )
        )
        .orderBy(sql`rank DESC`)
        .limit(100);

      const matches: GrepMatch[] = [];
      for (const result of results) {
        if (!result.content || !result.path) continue;

        const pathWithSlash = result.path.startsWith("/") ? result.path : `/${result.path}`;

        if (pathPrefix !== "/" && !pathWithSlash.startsWith(pathPrefix)) {
          continue;
        }

        if (glob && !micromatch.isMatch(pathWithSlash, glob)) {
          continue;
        }

        const lines = result.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line && regex.test(line)) {
            matches.push({
              path: pathWithSlash,
              line: i + 1,
              text: line,
            });
          }
        }
      }

      return matches;
    } catch (e) {
      if (e instanceof SyntaxError) {
        return `Invalid regex pattern: ${pattern}`;
      }
      throw e;
    }
  }

  private regexToTsQuery(pattern: string): string {
    const cleaned = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .join(" | ");
    return cleaned || "a";
  }

  async write(filePath: string, content: string): Promise<WriteResult> {
    getLogger({ component: "WebsiteFilesBackend" }).debug(
      { filePath, contentLength: content.length },
      "write"
    );

    debugLog(this.website.id, "WRITE_START", {
      filePath,
      contentLength: content.length,
      contentHash: Buffer.from(content).toString("base64").slice(0, 20),
      contentPreview: content.slice(0, 200).replace(/\n/g, "\\n"),
    });

    // Try to write first (for new files)
    let fsResult = await this.fs.write(filePath, content);

    // If file already exists, replace its entire content via edit
    if (fsResult.error?.includes("already exists")) {
      debugLog(this.website.id, "WRITE_FILE_EXISTS_REPLACING", { filePath });

      // Read current content to replace it entirely
      try {
        const fileData = await this.fs.readRaw(filePath);
        // FileData.content is string[] (array of lines)
        const currentContent = Array.isArray(fileData.content)
          ? fileData.content.join("\n")
          : String(fileData.content);

        // Replace entire content
        const editResult = await this.fs.edit(filePath, currentContent, content, false);
        if (editResult.error) {
          debugLog(this.website.id, "WRITE_REPLACE_FAILED", {
            filePath,
            error: editResult.error,
          });
          return { error: editResult.error };
        }

        fsResult = { path: filePath, filesUpdate: null };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        debugLog(this.website.id, "WRITE_REPLACE_ERROR", { filePath, error: errorMsg });
        return { error: errorMsg };
      }
    }

    debugLog(this.website.id, "WRITE_FS_COMPLETE", {
      filePath,
      error: fsResult.error ?? null,
    });

    if (fsResult.error) return fsResult;

    // Track dirty file for deferred flush (skip empty files — Rails rejects them)
    if (content) {
      this.dirtyPaths.add(filePath);
    }

    return {
      path: filePath,
      filesUpdate: null,
    };
  }

  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<EditResult> {
    getLogger({ component: "WebsiteFilesBackend" }).debug(
      {
        filePath,
        oldStringLength: oldString.length,
        newStringLength: newString.length,
        replaceAll,
      },
      "edit"
    );

    debugLog(this.website.id, "EDIT_START", {
      filePath,
      oldStringLength: oldString.length,
      newStringLength: newString.length,
      oldStringPreview: oldString.slice(0, 100).replace(/\n/g, "\\n"),
      newStringPreview: newString.slice(0, 100).replace(/\n/g, "\\n"),
      replaceAll,
    });

    const fsResult = await this.fs.edit(filePath, oldString, newString, replaceAll);
    if (fsResult.error) {
      // Enhanced error logging for debugging edit failures
      const editLog = getLogger({ component: "WebsiteFilesBackend" });
      editLog.warn(
        {
          filePath,
          error: fsResult.error,
          oldStringLength: oldString.length,
          oldStringPreview: oldString.slice(0, 200),
        },
        "Edit failed"
      );

      // Try to read current file content to help debug
      try {
        const currentContent = await this.fs.read(filePath, 0, 5000);

        // Check if it's a whitespace/newline issue
        const oldStringNormalized = oldString.replace(/\r\n/g, "\n").replace(/\s+/g, " ");
        const contentNormalized = currentContent.replace(/\r\n/g, "\n").replace(/\s+/g, " ");
        if (contentNormalized.includes(oldStringNormalized)) {
          editLog.warn(
            { filePath },
            "Whitespace mismatch detected - content exists but whitespace differs"
          );
        }
      } catch (readError) {
        editLog.debug({ filePath, err: readError }, "Could not read file for debugging");
      }

      debugLog(this.website.id, "EDIT_FS_FAILED", {
        filePath,
        error: fsResult.error,
      });

      return fsResult;
    }

    debugLog(this.website.id, "EDIT_FS_COMPLETE", {
      filePath,
      occurrences: fsResult.occurrences,
    });

    // Track dirty file for deferred flush
    this.dirtyPaths.add(filePath);

    return {
      path: filePath,
      occurrences: fsResult.occurrences,
      filesUpdate: null,
    };
  }

  /**
   * Returns true if any files have been written or edited since the last flush.
   */
  hasDirtyFiles(): boolean {
    return this.dirtyPaths.size > 0;
  }

  /**
   * Returns the list of file paths that have been modified since the last flush.
   */
  getDirtyPaths(): string[] {
    return [...this.dirtyPaths];
  }

  /**
   * Persist all dirty files to the database in a single batch API call.
   * Reads final content from the virtual filesystem and sends it via the
   * write endpoint (which handles both creates and updates).
   *
   * Idempotent — calling flush() with no dirty files is a no-op.
   */
  async flush(maxRetries: number = 2): Promise<void> {
    if (this.dirtyPaths.size === 0) {
      debugLog(this.website.id, "FLUSH_SKIP", { reason: "no dirty paths" });
      return;
    }

    const files: Array<{ path: string; content: string }> = [];

    for (const filePath of this.dirtyPaths) {
      try {
        const fileData = await this.fs.readRaw(filePath);
        const content = Array.isArray(fileData.content)
          ? fileData.content.join("\n")
          : String(fileData.content);

        // Skip empty files (Rails rejects them)
        if (!content) continue;

        files.push({ path: filePath, content });
      } catch (e) {
        // File was written then later deleted within the same session — skip
        getLogger({ component: "WebsiteFilesBackend" }).warn(
          { filePath, err: e },
          "Skipping dirty file that cannot be read"
        );
      }
    }

    if (files.length === 0) {
      debugLog(this.website.id, "FLUSH_SKIP", { reason: "all dirty files empty or unreadable" });
      this.dirtyPaths.clear();
      return;
    }

    debugLog(this.website.id, "FLUSH_START", {
      fileCount: files.length,
      paths: files.map((f) => f.path),
    });

    const service = new WebsiteFilesAPIService({ jwt: this.jwt });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await service.write({
          id: this.getWebsiteId(),
          files,
        });

        debugLog(this.website.id, "FLUSH_COMPLETE", { fileCount: files.length });
        this.dirtyPaths.clear();
        return;
      } catch (e) {
        if (attempt === maxRetries) throw e;
        getLogger({ component: "WebsiteFilesBackend" }).warn(
          { attempt, err: e },
          "Flush failed, retrying"
        );
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    // Not implemented - use write() instead for text files
    throw new Error("uploadFiles not implemented - use write() for text files");
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    // Not implemented - use read() instead
    throw new Error("downloadFiles not implemented - use read() for text files");
  }
}
