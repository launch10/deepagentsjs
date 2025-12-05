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

export interface DualBackendConfig {
  website: Website.WebsiteType;
  database?: DB;
}

export class DualBackend implements BackendProtocol {
  private fs: FilesystemBackend;
  private website: Website.WebsiteType;
  private database: DB;
  private rootDir: string;

  constructor(config: DualBackendConfig) {
    this.website = config.website;
    this.rootDir = this.makeRootDir();
    this.fs = new FilesystemBackend({
      rootDir: this.rootDir,
      virtualMode: true,
    });
    this.database = config.database ?? db;
  }

  makeRootDir(): string {
    const name = snakeCase(this.website.name);
    return `agents/websites/${this.website.accountId}/${name}`;
  }

  static async create(
    website: Website.WebsiteType,
    options?: { database?: DB }
  ): Promise<DualBackend> {
    const database = options?.database ?? db;

    const backend = new DualBackend({
      website,
      database,
    });

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
    const contentSha = shasum(content);

    await this.database
      .insert(websiteFiles)
      .values({
        websiteId: this.getWebsiteId(),
        path: normalizedPath,
        content,
        shasum: contentSha,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [websiteFiles.websiteId, websiteFiles.path],
        set: {
          content,
          shasum: contentSha,
          updatedAt: now,
        },
      });

    return { path: filePath, filesUpdate: null };
  }

  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<EditResult> {
    let rawContent: FileData;
    try {
      rawContent = await this.fs.readRaw(filePath);
    } catch (e: any) {
      return { error: `Error: File '${filePath}' not found` };
    }

    const content = rawContent.content.join("\n");
    const result = performStringReplacement(content, oldString, newString, replaceAll);

    if (typeof result === "string") {
      return { error: result };
    }

    const [newContent, occurrences] = result;
    const normalizedPath = filePath.startsWith("/")
      ? filePath.slice(1)
      : filePath;
    const now = new Date().toISOString();
    const contentSha = shasum(newContent);
    const resolvedPath = path.join(this.rootDir, normalizedPath);

    await Promise.all([
      fs.writeFile(resolvedPath, newContent),
      this.database
        .insert(websiteFiles)
        .values({
          websiteId: this.getWebsiteId(),
          path: normalizedPath,
          content: newContent,
          shasum: contentSha,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [websiteFiles.websiteId, websiteFiles.path],
          set: {
            content: newContent,
            shasum: contentSha,
            updatedAt: now,
          },
        }),
    ]);

    return {
      path: filePath,
      occurrences,
      filesUpdate: null,
    };
  }
}
