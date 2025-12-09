import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { join, dirname, relative } from "path";
import { db, websiteFiles, eq } from "@db";
import type { WebsiteFileType } from "@types";

export interface ScenarioConfig {
  websiteName: string;
  snapshotName: string;
  scenarioName: string;
  description?: string;
  createdAt: string;
  lastModifiedAt: string;
}

export interface ScenarioErrors {
  websiteId: number;
  website: string;
  snapshot: string;
  scenario: string;
  errors: any[];
  recordedAt: string;
}

export interface FileModification {
  searchPattern: string;
  replacement: string;
  description?: string;
}

export interface ModificationEntry {
  path: string;
  modifications: FileModification[];
}

export class ScenarioSaver {
  private websiteId: number;
  private websiteName: string;
  private snapshotName: string;
  private scenarioName: string;
  private scenarioDir: string;
  private modificationsDir: string;
  private configPath: string;
  private errorsPath: string;
  private originalFiles: Map<string, string> = new Map();
  private modifiedFiles: Map<string, string> = new Map();

  constructor(websiteId: number, websiteName: string, snapshotName: string, scenarioName: string) {
    this.websiteId = websiteId;
    this.websiteName = websiteName;
    this.snapshotName = snapshotName;
    this.scenarioName = scenarioName;

    // Set up paths
    this.scenarioDir = join(process.cwd(), "tests", "scenarios", websiteName, scenarioName);
    this.modificationsDir = join(this.scenarioDir, "modifications");
    this.configPath = join(this.scenarioDir, "config.json");
    this.errorsPath = join(this.scenarioDir, "errors.json");
  }

  /**
   * Load original files from database
   */
  async loadOriginalFiles(): Promise<void> {
    const files = await db
      .select()
      .from(websiteFiles)
      .where(eq(websiteFiles.websiteId, this.websiteId));

    for (const file of files) {
      this.originalFiles.set(file.path, file.content);
    }
  }

  /**
   * Track a modified file
   */
  trackModifiedFile(path: string, content: string): void {
    this.modifiedFiles.set(path, content);
  }

  /**
   * Get the scenario directory path
   */
  getScenarioDir(): string {
    return this.scenarioDir;
  }

  /**
   * Get the errors file path
   */
  getErrorsPath(): string {
    return this.errorsPath;
  }

  /**
   * Save the scenario to filesystem
   */
  async save(description?: string): Promise<void> {
    console.log(`\n💾 Saving scenario: ${this.scenarioName}`);

    // Create directories
    if (!existsSync(this.scenarioDir)) {
      mkdirSync(this.scenarioDir, { recursive: true });
    }
    if (!existsSync(this.modificationsDir)) {
      mkdirSync(this.modificationsDir, { recursive: true });
    }

    // Save config
    const config: ScenarioConfig = {
      websiteName: this.websiteName,
      snapshotName: this.snapshotName,
      scenarioName: this.scenarioName,
      description: description || `Scenario for ${this.websiteName}`,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
    };

    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    console.log(`   ✅ Saved config.json`);

    // Generate and save modifications
    const modifications = await this.generateModifications();

    for (const entry of modifications) {
      // Create the full path with directory structure
      const modPath = join(this.modificationsDir, `${entry.path}.json`);
      const modDir = dirname(modPath);

      // Create nested directories if needed
      if (!existsSync(modDir)) {
        mkdirSync(modDir, { recursive: true });
      }

      writeFileSync(modPath, JSON.stringify(entry, null, 2));
      console.log(`   ✅ Saved modifications for ${entry.path}`);
    }

    console.log(`✅ Scenario saved to: ${this.scenarioDir}`);
  }

  /**
   * Generate modifications by comparing original and modified files
   */
  private async generateModifications(): Promise<ModificationEntry[]> {
    const modifications: ModificationEntry[] = [];

    // Reload current files from database to compare
    const currentFiles = await db
      .select()
      .from(websiteFiles)
      .where(eq(websiteFiles.websiteId, this.websiteId));

    for (const file of currentFiles) {
      const originalContent = this.originalFiles.get(file.path);
      const currentContent = file.content;

      // Skip if no changes
      if (originalContent === currentContent) continue;

      // Generate modifications for this file
      const fileMods = this.diffToModifications(originalContent || "", currentContent, file.path);

      if (fileMods.length > 0) {
        modifications.push({
          path: file.path,
          modifications: fileMods,
        });
      }
    }

    return modifications;
  }

  /**
   * Simple diff to modifications converter
   * In production, you might want to use a proper diff library
   */
  private diffToModifications(original: string, current: string, path: string): FileModification[] {
    const mods: FileModification[] = [];

    // For now, we'll create a single modification that replaces the entire content
    // In a real implementation, you'd want to create more granular modifications
    if (original !== current) {
      // Try to find meaningful chunks that changed
      const originalLines = original.split("\n");
      const currentLines = current.split("\n");

      // Simple line-by-line comparison for demonstration
      let searchStart = -1;
      let searchEnd = -1;

      for (let i = 0; i < Math.max(originalLines.length, currentLines.length); i++) {
        if (originalLines[i] !== currentLines[i]) {
          if (searchStart === -1) searchStart = i;
          searchEnd = i;
        } else if (searchStart !== -1) {
          // Found a changed block
          const searchPattern = originalLines.slice(searchStart, searchEnd + 1).join("\n");
          const replacement = currentLines.slice(searchStart, searchEnd + 1).join("\n");

          if (searchPattern && replacement && searchPattern !== replacement) {
            mods.push({
              searchPattern,
              replacement,
              description: `Modified lines ${searchStart + 1}-${searchEnd + 1} in ${path}`,
            });
          }

          searchStart = -1;
          searchEnd = -1;
        }
      }

      // Handle changes at the end of the file
      if (searchStart !== -1) {
        const searchPattern = originalLines.slice(searchStart).join("\n");
        const replacement = currentLines.slice(searchStart).join("\n");

        if (searchPattern !== replacement) {
          mods.push({
            searchPattern,
            replacement,
            description: `Modified end of ${path}`,
          });
        }
      }
    }

    // Fallback: if no modifications were detected but content is different,
    // create a single modification for the entire file
    if (mods.length === 0 && original !== current) {
      mods.push({
        searchPattern: original,
        replacement: current,
        description: `Full file replacement for ${path}`,
      });
    }

    return mods;
  }
}

/**
 * Load a scenario configuration from filesystem
 */
export async function loadScenarioConfig(
  websiteName: string,
  scenarioName: string
): Promise<ScenarioConfig | null> {
  const configPath = join(
    process.cwd(),
    "tests",
    "scenarios",
    websiteName,
    scenarioName,
    "config.json"
  );

  if (!existsSync(configPath)) {
    return null;
  }

  return JSON.parse(readFileSync(configPath, "utf-8"));
}

/**
 * Load scenario errors from filesystem
 */
export async function loadScenarioErrors(
  websiteName: string,
  scenarioName: string
): Promise<ScenarioErrors | null> {
  const errorsPath = join(
    process.cwd(),
    "tests",
    "scenarios",
    websiteName,
    scenarioName,
    "errors.json"
  );

  if (!existsSync(errorsPath)) {
    return null;
  }

  return JSON.parse(readFileSync(errorsPath, "utf-8"));
}

/**
 * Load modifications for a scenario
 */
export async function loadScenarioModifications(
  websiteName: string,
  scenarioName: string
): Promise<ModificationEntry[]> {
  const modificationsDir = join(
    process.cwd(),
    "tests",
    "scenarios",
    websiteName,
    scenarioName,
    "modifications"
  );

  if (!existsSync(modificationsDir)) {
    return [];
  }

  const modifications: ModificationEntry[] = [];

  // Recursively find all .json files in the modifications directory
  function findJsonFiles(dir: string): string[] {
    const results: string[] = [];
    const items = readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...findJsonFiles(fullPath));
      } else if (item.name.endsWith(".json")) {
        results.push(fullPath);
      }
    }

    return results;
  }

  const jsonFiles = findJsonFiles(modificationsDir);

  for (const modPath of jsonFiles) {
    const entry = JSON.parse(readFileSync(modPath, "utf-8"));
    modifications.push(entry);
  }

  return modifications;
}
