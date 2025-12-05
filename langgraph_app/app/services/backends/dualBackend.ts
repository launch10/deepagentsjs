import type {
  BackendProtocol,
  EditResult,
  FileData,
  FileInfo,
  GrepMatch,
  WriteResult,
} from "deepagents";
import { FilesystemBackend } from "deepagents";
import { db, websiteFiles, codeFiles, eq, and, sql } from "@db";
import { Website } from "@types";
import type { DB } from "@db";
import { shasum } from "@ext";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { snakeCase } from "lodash";
import { WebsiteFilesAPIService } from "@services";

function performStringReplacement(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean
): string | [string, number] {
  const occurrences = content.split(oldString).length - 1;
  if (occurrences === 0) {
    return `Error: String not found in file: '${oldString}'`;
  }
  if (occurrences > 1 && !replaceAll) {
    return `Error: String '${oldString}' appears ${occurrences} times in file. Use replace_all=True to replace all instances, or provide a more specific string with surrounding context.`;
  }
  return [content.split(oldString).join(newString), occurrences];
}

export interface CreateBackendParams {
  website: Website.WebsiteType;
  jwt: string;
}

export class DualBackend implements BackendProtocol {
  private fs: FilesystemBackend;
  private website: Website.WebsiteType;
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
    const name = snakeCase(this.website.name);
    return `agents/websites/${this.website.accountId}/${name}`;
  }

  static async create(
    params: CreateBackendParams,
  ): Promise<DualBackend> {
    const backend = new DualBackend(params);
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

  async read(
    filePath: string,
    offset: number = 0,
    limit: number = 2000
  ): Promise<string> {
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
    path: string = "/",
    glob: string | null = null
  ): Promise<GrepMatch[] | string> {
    try {
      const regex = new RegExp(pattern);
      const tsQuery = this.regexToTsQuery(pattern);

      const results = await this.database
        .select({
          path: codeFiles.path,
          content: codeFiles.content,
          rank: sql<number>`ts_rank(content_tsv, to_tsquery('english', ${tsQuery}))`.as(
            "rank"
          ),
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

        const lines = result.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line && regex.test(line)) {
            const pathWithSlash = result.path.startsWith("/")
              ? result.path
              : `/${result.path}`;
            if (path === "/" || pathWithSlash.startsWith(path)) {
              matches.push({
                path: pathWithSlash,
                line: i + 1,
                text: line,
              });
            }
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
    const fsResult = await this.fs.write(filePath, content);
    if (fsResult.error) return fsResult;

    const normalizedPath = filePath.startsWith("/")
      ? filePath.slice(1)
      : filePath;
    const now = new Date().toISOString();
    const service = new WebsiteFilesAPIService({ jwt: this.jwt });
    const result = await service.write({
      id: this.getWebsiteId(),
      files: [{ path: normalizedPath, content }],
    });
    
    return { path: normalizedPath, filesUpdate: fsResult.filesUpdate };
  }

  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<EditResult> {
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
    
    return {
      path: filePath,
      occurrences: fsResult.occurrences,
      filesUpdate: fsResult.filesUpdate,
    };
  }
}
