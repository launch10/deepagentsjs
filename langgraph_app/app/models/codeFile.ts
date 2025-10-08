import { BaseView, sql, and, eq, or } from "./base";
import { codeFileSchema, CodeFileSourceEnum } from "@types";
import { codeFiles as codeFilesView } from "app/db";
import { db } from 'app/db';
import { SQL } from 'drizzle-orm';

// A "WebsiteFile" is distinguished from a "TemplateFile":
//
// TemplateFile: Boilerplate — A file that is part of the template. Aka a default package.json, or tsconfig.json
// WebsiteFile: User-Modified — A modified template file, or new page. Aka a user-modified package.json, or components/Hero.tsx, or pages/IndexPage.tsx
//
// "CodeFile" is a view that represents ALL files for a given website, whether they've been modified or not. 
// You should use WebsiteFile when you need to update user-modified files, and CodeFile for reading/querying files with full text search.
export class CodeFileModel extends BaseView<typeof codeFilesView, typeof codeFileSchema> {
  protected static entity = codeFilesView;
  protected static schema = codeFileSchema;

  /**
   * Get base select fields used by all queries that need custom selects
   * Ensures consistency across methods that need to add extra fields
   */
  private static getBaseSelectFields() {
    return {
      websiteId: this.entity.websiteId,
      path: this.entity.path,
      content: this.entity.content,
      contentTsv: this.entity.contentTsv,
      shasum: this.entity.shasum,
      fileSpecificationId: this.entity.fileSpecificationId,
      sourceType: this.entity.sourceType,
      sourceId: this.entity.sourceId,
      createdAt: this.entity.createdAt,
      updatedAt: this.entity.updatedAt,
    };
  }

  /**
   * Transform results to add computed 'source' field based on sourceType
   * Maps: 'WebsiteFile' → 'website', 'TemplateFile' → 'template'
   */
  private static transformResults(results: any[]): any[] {
    const resultsWithSource = results.map((r: any) => ({
      ...r,
      source: r.sourceType === 'WebsiteFile' ? 'website' : 'template'
    }));
    return resultsWithSource;
  }

  // Full-text search methods
  static async search(query: string, websiteId?: number) {
    let baseQuery = db
      .select()
      .from(this.entity)
      .where(
        sql`${this.entity.contentTsv} @@ plainto_tsquery('english', ${query})`
      );

    if (websiteId) {
      baseQuery = baseQuery.where(
        and(
          sql`${this.entity.contentTsv} @@ plainto_tsquery('english', ${query})`,
          eq(this.entity.websiteId, websiteId)
        )
      ) as any;
    }

    const results = await baseQuery;
    return this.transformResults(results);
  }

  // Search with ranking
  static async searchWithRank(query: string, websiteId?: number, limit = 10, pathFilter?: string) {
    const tsQuery = sql`plainto_tsquery('english', ${query})`;
    const rankExpr = sql`ts_rank(${this.entity.contentTsv}, ${tsQuery})`;
    
    let conditions = sql`${this.entity.contentTsv} @@ ${tsQuery}`;
    if (websiteId) {
      conditions = and(conditions, eq(this.entity.websiteId, websiteId))!;
    }
    if (pathFilter) {
      conditions = and(conditions, sql`${this.entity.path} ILIKE ${'%' + pathFilter + '%'}`)!;
    }
    
    const results = await db
      .select({
        ...this.getBaseSelectFields(),
        rank: sql<number>`${rankExpr}`
      })
      .from(this.entity)
      .where(conditions)
      // Order by rank first, then by path for consistent ordering when ranks are equal
      .orderBy(sql`${rankExpr} DESC`, this.entity.path)
      .limit(limit);

    return this.transformResults(results);
  }

  // Phrase search
  static async searchPhrase(phrase: string, websiteId?: number, limit = 10, pathFilter?: string) {
    const tsQuery = sql`phraseto_tsquery('english', ${phrase})`;
    // Use ts_rank_cd for better phrase ranking
    const rankExpr = sql`ts_rank_cd(${this.entity.contentTsv}, ${tsQuery})`;
    
    let conditions = sql`${this.entity.contentTsv} @@ ${tsQuery}`;
    if (websiteId) {
      conditions = and(conditions, eq(this.entity.websiteId, websiteId))!;
    }
    if (pathFilter) {
      conditions = and(conditions, sql`${this.entity.path} ILIKE ${'%' + pathFilter + '%'}`)!;
    }
    
    const baseQuery = db
      .select({
        ...this.getBaseSelectFields(),
        rank: sql<number>`${rankExpr}`
      })
      .from(this.entity)
      .where(conditions)
      // Order by rank first, then by path for consistent ordering when ranks are equal
      .orderBy(sql`${rankExpr} DESC`, this.entity.path)
      .limit(limit);

    const results = await baseQuery;
    return this.transformResults(results);
  }

  // Boolean search (supports AND, OR, NOT operators)
  static async searchBoolean(query: string, websiteId?: number, limit = 10, pathFilter?: string) {
    const tsQuery = sql`to_tsquery('english', ${query})`;
    // Use ts_rank_cd (cover density) for better boolean query ranking
    const rankExpr = sql`ts_rank_cd(${this.entity.contentTsv}, ${tsQuery})`;
    
    let conditions = sql`${this.entity.contentTsv} @@ ${tsQuery}`;
    if (websiteId) {
      conditions = and(conditions, eq(this.entity.websiteId, websiteId))!;
    }
    if (pathFilter) {
      conditions = and(conditions, sql`${this.entity.path} ILIKE ${'%' + pathFilter + '%'}`)!;
    }
    
    const baseQuery = db
      .select({
        ...this.getBaseSelectFields(),
        rank: sql<number>`${rankExpr}`
      })
      .from(this.entity)
      .where(conditions)
      // Order by rank first, then by path for consistent ordering when ranks are equal
      .orderBy(sql`${rankExpr} DESC`, this.entity.path)

    const results = await baseQuery.limit(limit);
    return this.transformResults(results);
  }

  // Path-based search using trigram similarity
  static async pathSimilarTo(path: string, websiteId?: number, threshold = 0.3) {
    const similarityExpr = sql`similarity(${this.entity.path}, ${path})`;
    
    let conditions = sql`${similarityExpr} > ${threshold}`;
    if (websiteId) {
      conditions = and(conditions, eq(this.entity.websiteId, websiteId))!;
    }

    const results = await db
      .select({
        ...this.getBaseSelectFields(),
        pathSimilarity: sql<number>`${similarityExpr}`
      })
      .from(this.entity)
      .where(conditions)
      .orderBy(sql`${similarityExpr} DESC`);

    return this.transformResults(results);
  }

  // Fuzzy path search using ILIKE for pattern matching
  static async pathFuzzy(pattern?: string, websiteId?: number, limit?: number) {
    let conditions;
    if (!pattern) {
      conditions = sql`1=1`;
    } else {
      conditions = sql`${this.entity.path} ILIKE ${'%' + pattern + '%'}`;
    }
    
    if (websiteId) {
      conditions = and(conditions, eq(this.entity.websiteId, websiteId))!;
    }
    
    let baseQuery = db
      .select()
      .from(this.entity)
      .where(conditions)
      .orderBy(this.entity.path);
    
    if (limit) {
      baseQuery = baseQuery.limit(limit);
    }

    const results = await baseQuery;
    return this.transformResults(results);
  }

  // Search with highlighted results
  static async searchWithHighlights(
    query: string, 
    websiteId?: number,
    options: {
      startSel?: string;
      stopSel?: string;
      maxWords?: number;
      minWords?: number;
    } = {}
  ) {
    const { 
      startSel = '<mark>', 
      stopSel = '</mark>', 
      maxWords = 20,
      minWords = 10 
    } = options;

    const tsQuery = sql`plainto_tsquery('english', ${query})`;
    
    let conditions = sql`${this.entity.contentTsv} @@ ${tsQuery}`;
    if (websiteId) {
      conditions = and(conditions, eq(this.entity.websiteId, websiteId))!;
    }

    const results = await db
      .select({
        ...this.getBaseSelectFields(),
        highlightedContent: sql<string>`
          ts_headline(
            'english', 
            ${this.entity.content}, 
            ${tsQuery},
            'StartSel=${startSel}, StopSel=${stopSel}, MaxWords=${maxWords}, MinWords=${minWords}'
          )`
      })
      .from(this.entity)
      .where(conditions);

    return this.transformResults(results);
  }

  // Get files by type
  static async byFileType(websiteId: number, extensions: string[]) {
    const conditions = extensions.map(ext => 
      sql`${this.entity.path} ILIKE ${'%.' + ext}`
    );

    const results = await db
      .select()
      .from(this.entity)
      .where(
        and(
          eq(this.entity.websiteId, websiteId),
          or(...conditions)
        )
      );

    return results;
  }

  // Scope methods
  static async fromWebsite(websiteId: number) {
    return this.where({ 
      websiteId, 
      source: CodeFileSourceEnum.Website 
    });
  }

  static async fromTemplate(websiteId: number) {
    return this.where({ 
      websiteId, 
      source: CodeFileSourceEnum.Template 
    });
  }

  // Get JavaScript/TypeScript files
  static async javascriptFiles(websiteId: number) {
    return this.byFileType(websiteId, ['js', 'jsx']);
  }

  static async typescriptFiles(websiteId: number) {
    return this.byFileType(websiteId, ['ts', 'tsx']);
  }

  static async cssFiles(websiteId: number) {
    return this.byFileType(websiteId, ['css', 'scss', 'sass']);
  }

  static async htmlFiles(websiteId: number) {
    return this.byFileType(websiteId, ['html', 'htm']);
  }

  // Count matches by website
  static async countMatchesByWebsite(query: string) {
    const results = await db
      .select({
        websiteId: this.entity.websiteId,
        count: sql<number>`count(*)`
      })
      .from(this.entity)
      .where(
        sql`${this.entity.contentTsv} @@ plainto_tsquery('english', ${query})`
      )
      .groupBy(this.entity.websiteId);

    return results;
  }

  // Instance methods
  get isWebsiteFile(): boolean {
    return this.data.source === CodeFileSourceEnum.Website;
  }

  get isTemplateFile(): boolean {
    return this.data.source === CodeFileSourceEnum.Template;
  }

  get fileType(): string {
    const match = this.data.path.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  }

  get language(): string {
    const ext = this.fileType;
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'rb': 'ruby',
      'py': 'python',
      'css': 'css',
      'scss': 'css',
      'sass': 'css',
      'html': 'html',
      'htm': 'html'
    };
    return languageMap[ext] || ext;
  }
}