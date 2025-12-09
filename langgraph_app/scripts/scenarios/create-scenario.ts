#!/usr/bin/env tsx
/**
 * Interactive Scenario Creator
 * Create a new scenario from a snapshot
 */

import { ScenarioCore } from "./core";

class ScenarioCreator extends ScenarioCore {
  async collectInputs(): Promise<void> {
    console.log("");
    console.log("============================================================");
    console.log("🎬 Scenario Creator");
    console.log("");
    console.log("This tool allows you to create test scenarios from snapshots.");
    console.log("You can edit files and save the modifications for testing.");
    console.log("============================================================");

    this.snapshotName = await this.selectSnapshot();
    this.websiteName = await this.selectWebsite();
    this.scenarioName = await this.getScenarioName();
    this.editor = await this.selectEditor();
    this.saveMode = "scenario";
  }
}

new ScenarioCreator().run();
