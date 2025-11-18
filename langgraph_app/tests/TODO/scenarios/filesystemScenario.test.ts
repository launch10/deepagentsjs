import { describe, it, expect, beforeAll } from 'vitest';
import { runScenario, ScenarioRunner } from '@services';

describe('Filesystem Scenario Tests', () => {
  describe('Loading scenario from filesystem', () => {
    it('should load and run a scenario saved from editor', async () => {
      // This assumes you've created a scenario using the editor
      // with save mode = 'modifications'
      const scenario = await runScenario({
        website: 'space-quest',
        scenario: 'import_errors', // This will load from tests/scenarios/space-quest/import_errors/
        force: false, // Use cache if available
        log: true
      });

      // The scenario automatically:
      // 1. Loads config.json to get the snapshot name
      // 2. Loads all modifications from the modifications/ folder
      // 3. Restores the snapshot
      // 4. Applies the modifications
      // 5. Runs the website and captures errors
      // 6. Caches the results (invalidated if config.json changes)

      expect(scenario.errors).toBeDefined();
      expect(scenario.errors[0].message).toContain(`The requested module '/src/components/Nav.tsx' does not provide an export named 'NavNonexistent'`)
    });

    it('should load and run a different scenario', async () => {
      // This assumes you've created a scenario using the editor
      // with save mode = 'modifications'
      const scenario = await runScenario({
        website: 'space-quest',
        scenario: 'broken_links',
        force: false, // Use cache if available
        log: true
      });

      expect(scenario.errors).toBeDefined();
      expect(scenario.errors.length).toEqual(0); // Broken links won't cause JS errors

      expect(scenario.warnings.length).toBe(2);
    });
  });
});