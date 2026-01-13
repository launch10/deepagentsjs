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
import _ from "lodash";
import micromatch from "micromatch";
import { WebsiteFilesAPIService } from "@rails_api";
import { RedisLock } from "@ext";

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
    await fs.rm(this.rootDir, { recursive: true, force: true });
  }

  async lsInfo(path: string): Promise<FileInfo[]> {
    return this.fs.lsInfo(path);
  }

  async read(filePath: string, offset: number = 0, limit: number = 2000): Promise<string> {
    return this.fs.read(filePath, offset, limit);
  }

  async readRaw(filePath: string): Promise<FileData> {
    return this.fs.readRaw(filePath);
  }

  async globInfo(pattern: string, path: string = "/"): Promise<FileInfo[]> {
    return this.fs.globInfo(pattern, path);
  }

  async grepRaw(
    pattern: string,
    pathPrefix: string = "/",
    glob: string | null = null
  ): Promise<GrepMatch[] | string> {
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
    const lockKey = `file:${this.getWebsiteId()}:${filePath}`;
    return RedisLock.withLock(lockKey, async () => {
      const fsResult = await this.fs.write(filePath, content);
      if (fsResult.error) return fsResult;

      const service = new WebsiteFilesAPIService({ jwt: this.jwt });
      await service.write({
        id: this.getWebsiteId(),
        files: [{ path: filePath, content }],
      });

      return {
        path: filePath,
        filesUpdate: null,
      };
    });
  }

  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<EditResult> {
    const lockKey = `file:${this.getWebsiteId()}:${filePath}`;
    return RedisLock.withLock(lockKey, async () => {
      const fsResult = await this.fs.edit(filePath, oldString, newString, replaceAll);
      if (fsResult.error) {
        return fsResult;
      }

      const service = new WebsiteFilesAPIService({ jwt: this.jwt });
      await service.edit({
        id: this.getWebsiteId(),
        path: filePath,
        oldString,
        newString,
        replaceAll,
      });

      return {
        path: filePath,
        occurrences: fsResult.occurrences,
        filesUpdate: null,
      };
    });
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
