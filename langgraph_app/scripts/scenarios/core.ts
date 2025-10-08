import readline from 'readline/promises';
import { db, websites } from '@db';
import { databaseSnapshotter, startWebsiteEditor, type WebsiteEditorOptions } from '@services';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
export abstract class ScenarioCore {
  rl: readline.Interface;
  websiteName!: string;
  snapshotName!: string;
  editor!: string;
  saveMode!: string;
  scenarioName!: string;
  autoOpen!: boolean;
  existingScenario?: string;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  abstract collectInputs(): Promise<void>;

  async run() {
    try {
      await this.collectInputs();
      this.rl.close();
      await startWebsiteEditor({
        websiteName: this.websiteName,
        snapshotName: this.snapshotName,
        editor: this.editor,
        saveMode: this.saveMode,
        scenarioName: this.scenarioName,
        autoOpen: this.autoOpen,
        existingScenario: this.existingScenario
      } as WebsiteEditorOptions);
    } catch(error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  }

  public async selectWebsite(): Promise<string> {
    // Get all available websites
    const allWebsites = await db.select().from(websites);
    
    console.log('\n📦 Available websites:');
    allWebsites.forEach((site, index) => {
      console.log(`  ${index + 1}. ${site.name}`);
    });
    
    const choice = await this.rl.question('\nSelect a website (number or name): ');
    
    // Check if it's a number
    const index = parseInt(choice) - 1;
    if (!isNaN(index) && index >= 0 && index < allWebsites.length) {
      return allWebsites[index].name;
    }
    
    // Check if it's a valid name
    const website = allWebsites.find(w => w.name === choice);
    if (website) {
      return website.name;
    }
    
    console.log('❌ Invalid selection');
    return this.selectWebsite();
  }

  public async selectSnapshot(): Promise<string> {
    // Get all available snapshots
    const snapshots: string[] = await databaseSnapshotter.listSnapshots();
    const snapsById: Record<number, string> = {}
    const snapsByName: Record<string, string> = {}
    
    console.log('\n📸 Available snapshots:');
    snapshots.forEach((snapshot, index) => {
      console.log(`  ${index + 1}. ${snapshot}`);
      snapsById[index + 1] = snapshot;
      snapsByName[snapshot] = snapshot;
    });

    console.log(`  ${snapshots.length + 1}. [Create new snapshot]`);
    
    const choice = await this.rl.question('\nSelect a snapshot (number or name): ');

    const isNumber = !Number.isNaN(Number(choice))
    let snapshot;
    if (isNumber) {
      snapshot = snapsById[parseInt(choice)]
    } else {
      snapshot = snapsByName[choice]
    }

    if (!snapshot || !snapshots.includes(snapshot)) {
      console.log('❌ Invalid snapshot selection');
      return this.selectSnapshot();
    }

    console.log(`\nRestoring snapshot: ${snapshot}`);
    await databaseSnapshotter.restoreSnapshot(snapshot);

    return snapshot;
  }

  public async selectEditor(): Promise<string> {
    const editors = [
      'windsurf',
      'code',
      'cursor',
      'sublime',
      'atom',
      'vim',
      'nvim',
      'emacs'
    ];
  
    console.log('\n🎨 Available editors:');
    editors.forEach((editor, index) => {
      console.log(`  ${index + 1}. ${editor}`);
    });
    console.log(`  ${editors.length + 1}. [Custom command]`);
    
    const choice = await this.rl.question('\nSelect an editor (number or name) [default: windsurf]: ');
    
    if (!choice) {
      return 'windsurf';
    }
    
    // Check if it's a number
    const index = parseInt(choice) - 1;
    if (!isNaN(index)) {
      if (index >= 0 && index < editors.length) {
        return editors[index] as string;
      }
      if (index === editors.length) {
        const custom = await this.rl.question('Enter custom editor command: ');
        return custom;
      }
    }
    
    // Return as-is (either editor name or custom command)
    return choice;
  }

  public async getScenarioName(): Promise<string> {
    console.log('\n📝 Enter a name for this scenario');
    console.log('   (e.g., "import_errors", "missing_components", "broken_links")');
    
    const name = await this.rl.question('\nScenario name: ');
    
    if (!name) {
      console.log('❌ Scenario name is required');
      return this.getScenarioName();
    }
    
    // Sanitize the name (remove special characters, spaces to underscores)
    const sanitized = name.toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    if (sanitized !== name) {
      console.log(`   ℹ️  Using sanitized name: ${sanitized}`);
    }
    
    return sanitized;
  }

  public async selectScenario(websiteName: string): Promise<string> {
    const scenariosDir = join(process.cwd(), 'tests', 'scenarios', websiteName);
    
    if (!existsSync(scenariosDir)) {
      console.log(`No scenarios found for ${websiteName}`);
      process.exit(1);
    }
    
    const scenarios = readdirSync(scenariosDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    if (scenarios.length === 0) {
      console.log(`No scenarios found for ${websiteName}`);
      process.exit(1);
    }
    
    console.log('\n📚 Available scenarios:');
    scenarios.forEach((scenario, index) => {
      console.log(`  ${index + 1}. ${scenario}`);
    });
    
    const answer = await this.rl.question('\nSelect a scenario to edit (number or name): ');
    
    const index = parseInt(answer) - 1;
    if (!isNaN(index) && index >= 0 && index < scenarios.length) {
      return scenarios[index];
    }
    
    if (scenarios.includes(answer)) {
      return answer;
    }
    
    console.log('Invalid selection');
    return this.selectScenario(websiteName);
  }

  public async getScenarioConfig(websiteName: string, scenarioName: string): Promise<any> {
    const configPath = join(process.cwd(), 'tests', 'scenarios', websiteName, scenarioName, 'config.json');
    
    if (!existsSync(configPath)) {
      throw new Error(`Config not found for scenario ${scenarioName}`);
    }
    
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }
}