#!/usr/bin/env tsx
/**
 * Interactive Snapshot Editor
 * Edit website files and save changes back to a snapshot
 */

import { ScenarioCore } from './core';

class SnapshotEditor extends ScenarioCore {
  async collectInputs(): Promise<void> {
    console.log('');
    console.log('============================================================');
    console.log('📸 Snapshot Editor');
    console.log('');
    console.log('This tool allows you to edit website files locally,');
    console.log('preview changes in a dev server, and save them to snapshots.');
    console.log('============================================================');
    
    this.snapshotName = await this.selectSnapshot();
    this.websiteName = await this.selectWebsite();
    this.editor = await this.selectEditor();
    this.saveMode = 'snapshot';
    this.autoOpen = true;
    
    // Display configuration
    console.log('\n');
    console.log('============================================================');
    console.log('Starting snapshot editor with:');
    console.log(`  Website: ${this.websiteName}`);
    console.log(`  Snapshot: ${this.snapshotName}`);
    console.log(`  Editor: ${this.editor}`);
    console.log(`  Save mode: snapshot`);
    console.log('============================================================');
  }
}

new SnapshotEditor().run();