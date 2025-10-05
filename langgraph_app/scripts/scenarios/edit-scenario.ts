#!/usr/bin/env tsx
/**
 * Interactive Scenario Editor
 * Edit an existing scenario by applying its modifications and allowing further changes
 */

import { ScenarioCore } from './core';

class ScenarioEditor extends ScenarioCore {
  async collectInputs(): Promise<void> {
    console.log('');
    console.log('============================================================');
    console.log('📝 Scenario Editor');
    console.log('');
    console.log('This tool allows you to edit existing scenarios,');
    console.log('apply their modifications, and make additional changes.');
    console.log('============================================================');
    
    this.snapshotName = await this.selectSnapshot();
    this.websiteName = await this.selectWebsite();
    this.existingScenario = await this.selectScenario(this.websiteName);

    const config = await this.getScenarioConfig(this.websiteName, this.existingScenario);
    this.snapshotName = config.snapshotName;
    
    // Get new scenario name
    console.log('\n📝 Enter a name for the edited scenario');
    console.log(`   (press Enter to overwrite '${this.existingScenario}'):`);
    const scenarioNameInput = await this.rl.question('\nScenario name: ');
    this.scenarioName = scenarioNameInput || this.existingScenario;
    
    // Select editor
    this.editor = await this.selectEditor();
    
    // Set mode for modifications
    this.saveMode = 'scenario';
    this.autoOpen = true;
    
    // Display configuration
    console.log('\n');
    console.log('============================================================');
    console.log('Starting scenario editor with:');
    console.log(`  Website: ${this.websiteName}`);
    console.log(`  Original scenario: ${this.existingScenario}`);
    console.log(`  New scenario name: ${this.scenarioName}`);
    console.log(`  Snapshot: ${this.snapshotName}`);
    console.log(`  Editor: ${this.editor}`);
    console.log('============================================================');
  }
}

new ScenarioEditor().run();