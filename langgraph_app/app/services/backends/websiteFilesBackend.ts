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
import { db, codeFiles, eq, and, sql, Types as DBTypes, type DB } from "@db";
import * as fs from "fs/promises";
import * as path from "path";
import { snakeCase } from "lodash";
import micromatch from "micromatch";
import { WebsiteFilesAPIService } from "@rails_api";

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
    const name = snakeCase(this.website.name ?? "");
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
    console.log(`hydrating...`);
    const files = await this.database
      .select({
        path: codeFiles.path,
        content: codeFiles.content,
      })
      .from(codeFiles)
      .where(eq(codeFiles.websiteId, this.getWebsiteId()));

    await this.cleanup();

    for (const file of files) {
      if (!file.path || !file.content) continue;

      const filePath = path.join(this.rootDir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }

  async cleanup(): Promise<void> {
    console.log(`cleaning up...`);
    await fs.rm(this.rootDir, { recursive: true, force: true });
  }

  async lsInfo(path: string): Promise<FileInfo[]> {
    console.log(`lsInfo ${path}`);
    return this.fs.lsInfo(path);
  }

  async read(filePath: string, offset: number = 0, limit: number = 2000): Promise<string> {
    console.log(`read ${filePath}`);
    return this.fs.read(filePath, offset, limit);
  }

  async readRaw(filePath: string): Promise<FileData> {
    console.log(`readRaw ${filePath}`);
    return this.fs.readRaw(filePath);
  }

  async globInfo(pattern: string, path: string = "/"): Promise<FileInfo[]> {
    console.log(`globInfo ${pattern}`)
    return this.fs.globInfo(pattern, path);
  }

  async grepRaw(
    pattern: string,
    pathPrefix: string = "/",
    glob: string | null = null
  ): Promise<GrepMatch[] | string> {
    console.log(`grepRaw ${pattern} ${pathPrefix} ${glob}`);
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
    console.log(`writing ${filePath}`);
    const fsResult = await this.fs.write(filePath, content);
    if (fsResult.error) return fsResult;

    const service = new WebsiteFilesAPIService({ jwt: this.jwt });
    const result = await service.write({
      id: this.getWebsiteId(),
      files: [{ path: filePath, content }],
    });

    // Return filesUpdate so middleware syncs to state
    const now = new Date().toISOString();
    return {
      path: filePath,
      filesUpdate: null,
      // filesUpdate: {
      //   [filePath]: {
      //     content: content.split("\n"),
      //     created_at: now,
      //     modified_at: now,
      //   },
      // },
    };
  }

  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<EditResult> {
    console.log(`editing ${filePath}`);
    const fsResult = await this.fs.edit(filePath, oldString, newString, replaceAll);
    if (fsResult.error) return fsResult;

    const service = new WebsiteFilesAPIService({ jwt: this.jwt });
    const result = await service.edit({
      id: this.getWebsiteId(),
      path: filePath,
      oldString,
      newString,
      replaceAll,
    });

    // Read updated content from filesystem for filesUpdate
    const normalizedPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    const fullPath = path.join(this.rootDir, normalizedPath);
    const updatedContent = await fs.readFile(fullPath, "utf-8");

    // Return filesUpdate so middleware syncs to state
    const now = new Date().toISOString();
    return {
      path: filePath,
      occurrences: fsResult.occurrences,
      filesUpdate: null,
      // filesUpdate: {
      //   [filePath]: {
      //     content: updatedContent.split("\n"),
      //     created_at: now,
      //     modified_at: now,
      //   },
      // },
    };
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
