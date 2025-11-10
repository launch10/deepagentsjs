import { z } from "zod";
import { databaseSnapshotter } from '@services';
import { ErrorExporter } from "@services";
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { db, websiteFiles, websites, eq, sql } from '@db';
import type { WebsiteFileType, ConsoleError } from '@types';
import { loadScenarioConfig, loadScenarioModifications } from './scenarioSaver';
import { withTimestamps } from '@db';

// File modification schema for inline modifications
export const fileModificationSchema = z.object({
  path: z.string(),
  searchPattern: z.string().or(z.instanceof(RegExp)),
  replacement: z.string(),
  description: z.string().optional(),
});

export type FileModificationType = z.infer<typeof fileModificationSchema>;

export interface ScenarioOptions {
  website: string;
  snapshot?: string; // Optional if loading from filesystem
  scenario?: string; // Load scenario from filesystem
  modifications?: FileModificationType[]; // Inline modifications
  force?: boolean; // Force re-recording even if cache exists
  log?: boolean;
}

export class ScenarioRunner {
  private website: string;
  private snapshot?: string;
  private scenario?: string;
  private modifications: FileModificationType[] = [];
  private force: boolean;
  public _errors: ConsoleError[] = [];
  private errorsFile: string;
  private shouldLog: boolean;
  private websiteId?: number;
  private configLastModified?: Date;
  private scenarioDir: string;

  constructor(options: ScenarioOptions) {
    this.website = options.website;
    this.scenario = options.scenario;
    this.snapshot = options.snapshot;
    this.modifications = options.modifications || [];
    this.force = options.force || false;
    this.shouldLog = options.log || false;
    
    // Set scenario directory and errors file path
    if (this.scenario) {
      this.scenarioDir = join(process.cwd(), 'tests', 'scenarios', this.website, this.scenario);
      this.errorsFile = join(this.scenarioDir, 'errors.json');
    } else {
      // For inline scenarios, use a temp location
      this.scenarioDir = '';
      this.errorsFile = '';
    }
  }

  get errors(): ConsoleError[] {
    return this._errors.filter(e => e.type === 'error');
  }

  get warnings(): ConsoleError[] {
    return this._errors.filter(e => e.type === 'warning');
  }

  private log(message: string): void {
    if (this.shouldLog) {
      console.log(message);
    }
  }

  async setup(): Promise<this> {
    // Load scenario from filesystem if specified
    if (this.scenario) {
      await this.loadScenarioFromFilesystem();
    }

    if (this.snapshot) {
      await databaseSnapshotter.restoreSnapshot(this.snapshot);
    }

    this.log(`restoring snapshot: ${this.snapshot}`);

    const [site] = await db.select()
      .from(websites)
      .where(eq(websites.name, this.website))
      .limit(1);

    this.websiteId = site?.id;

    if (!this.websiteId) {
      throw new Error(`Website not found: ${this.website}`);
    }

    if (this.modifications && this.modifications.length > 0) {
      await this.applyModifications();
    }

    return this;
  }

  /**
   * Load scenario configuration and modifications from filesystem
   */
  private async loadScenarioFromFilesystem(): Promise<void> {
    const config = await loadScenarioConfig(this.website, this.scenario!);
    
    if (!config) {
      throw new Error(`Scenario not found: ${this.website}/${this.scenario}`);
    }

    // Use snapshot from config if not explicitly provided
    if (!this.snapshot) {
      this.snapshot = config.snapshotName;
    }

    // Get last modified time of config
    const configPath = join(process.cwd(), 'tests', 'scenarios', this.website, this.scenario!, 'config.json');
    const stats = statSync(configPath);
    this.configLastModified = stats.mtime;

    // Load modifications from filesystem
    const fsModifications = await loadScenarioModifications(this.website, this.scenario!);
    
    // Convert filesystem modifications to our format
    const convertedMods: FileModificationType[] = [];
    for (const entry of fsModifications) {
      for (const mod of entry.modifications) {
        convertedMods.push({
          path: entry.path,
          searchPattern: mod.searchPattern,
          replacement: mod.replacement,
          description: mod.description
        });
      }
    }

    // Merge with any inline modifications
    this.modifications = [...convertedMods, ...this.modifications];
    
    this.log(`Loaded scenario: ${this.scenario} with ${convertedMods.length} modifications`);
  }

  /**
   * Check if errors cache is still valid
   */
  private isErrorsCacheValid(): boolean {
    if (!this.scenario || !this.errorsFile) {
      return false; // No caching for inline scenarios
    }

    if (!existsSync(this.errorsFile)) {
      this.log('Errors file does not exist, will record new errors...');
      return false;
    }

    // Check if any modifications are newer than the errors file
    const errorsStats = statSync(this.errorsFile);
    const configPath = join(this.scenarioDir, 'config.json');
    
    if (existsSync(configPath)) {
      const configStats = statSync(configPath);
      if (configStats.mtime > errorsStats.mtime) {
        this.log('Config is newer than errors cache, invalidating...');
        return false;
      }
    }

    // Check modification files
    const modificationsDir = join(this.scenarioDir, 'modifications');
    if (existsSync(modificationsDir)) {
      const checkModificationTimes = (dir: string): boolean => {
        const items = readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = join(dir, item.name);
          if (item.isDirectory()) {
            if (!checkModificationTimes(fullPath)) return false;
          } else if (item.name.endsWith('.json')) {
            const modStats = statSync(fullPath);
            if (modStats.mtime > errorsStats.mtime) {
              this.log(`Modification ${item.name} is newer than errors cache, invalidating...`);
              return false;
            }
          }
        }
        return true;
      };
      
      if (!checkModificationTimes(modificationsDir)) {
        return false;
      }
    }

    return true;
  }

  protected async loadErrors(): Promise<this> {
    // Check if we have cached errors and not forcing re-record
    if (!this.force && this.isErrorsCacheValid()) {
      return this.loadCachedErrors();
    } else { 
      return await this.recordErrors();
    }
  }

  protected loadCachedErrors(): this { 
    this.log(`📂 Loading errors from cache: ${this.errorsFile}`);
    const cached = JSON.parse(readFileSync(this.errorsFile, 'utf-8'));
    
    // Convert dates back from strings
    this._errors = cached.errors.map((error: any) => ({
      ...error,
      timestamp: new Date(error.timestamp)
    }));
    
    this.log(`✅ Loaded ${this.errors.length} cached error(s)`);
    return this;
  }

  protected async recordErrors(): Promise<this> {
    // Run fresh scenario
    this.log(`🎬 Recording new errors for website ${this.website}...`);
    
    // Run website and capture errors using await using for proper cleanup
    await using exporter = new ErrorExporter(this.websiteId!);
    this._errors = await exporter.run();
    
    // Save to cache
    this.saveErrorsToCache();
    
    this.log(`✅ Recorded ${this.errors.length} error(s)`);
    return this;
  }

  /**
   * Run the scenario - either from cache or fresh
   */
  async run(): Promise<this> {
    await this.setup();
    return await this.loadErrors();
  }

  /**
   * Apply modifications to the website before running
   */
  public async applyModifications(): Promise<void> {
    this.log(`📝 Applying ${this.modifications!.length} modification(s)...`);
    
    const files = await db.select().from(websiteFiles).where(eq(websiteFiles.websiteId, this.websiteId!));
    const fileMap: Map<string, WebsiteFileType> = new Map(files.map((file: WebsiteFileType) => [file.path, file]));
    const allUpdates: Partial<string>[] = []

    for (const mod of this.modifications!) {
      this.log(`  - Modifying ${mod.path}`);
      let file = fileMap.get(mod.path);
      
      if (!file) {
        const [newFile] = await db.insert(websiteFiles)
          .values(withTimestamps({
            websiteId: this.websiteId!,
            path: mod.path,
            content: ''
          }))
          .returning()
          .execute();
        file = newFile;
        fileMap.set(mod.path, {...newFile, content: ''});
      }
      
      const updatedContent = await this.applyFileModification(mod, file);
      fileMap.set(mod.path, {...file, content: updatedContent});
      allUpdates.push(mod.path);
    }

    const uniqueUpdates = [...new Set(allUpdates)];
    const updatedFiles = uniqueUpdates.map(path => fileMap.get(path));

    if (uniqueUpdates.length > 0) {
      await db
        .insert(websiteFiles)
        .values(updatedFiles)
        .onConflictDoUpdate({
          target: websiteFiles.id,
          set: { content: sql.raw(`excluded.${websiteFiles.content.name}`) },
        });
    }
  }

  /**
   * Apply a file modification
   */
  protected async applyFileModification(mod: FileModificationType, file: WebsiteFileType): Promise<string> {
    let newContent = file.content;
    
    // Special case: if searching for empty string and current content is empty, 
    // just return the replacement (this is a new file)
    if (mod.searchPattern === '' && newContent === '') {
      return mod.replacement;
    }
    
    if (typeof mod.searchPattern === 'string') {
      newContent = newContent.replace(mod.searchPattern, mod.replacement);
    } else {
      newContent = newContent.replace(mod.searchPattern, mod.replacement);
    }

    return newContent;
  }

  /**
   * Save errors to cache
   */
  private saveErrorsToCache(): void {
    if (!this.scenario || !this.errorsFile) {
      return; // Don't cache inline scenarios
    }
    
    const errorsData = {
      websiteId: this.websiteId,
      website: this.website,
      snapshot: this.snapshot,
      scenario: this.scenario,
      errors: this.errors,
      recordedAt: new Date().toISOString()
    };
    
    writeFileSync(this.errorsFile, JSON.stringify(errorsData, null, 2));
    this.log(`💾 Saved errors to: ${this.errorsFile}`);
  }

  /**
   * Get only JavaScript errors (not warnings)
   */
  getConsoleErrors(): ConsoleError[] {
    return this.errors;
  }

}

/**
 * Convenience function to create and run a scenario
 */
export async function runScenario(options: ScenarioOptions): Promise<ScenarioRunner> {
  const runner = new ScenarioRunner(options);
  return await runner.run();
}