import { describe, it, expect, beforeAll } from 'vitest';
import { testGraph } from '@support';
import { DatabaseSnapshotter } from '@services';
import { routerGraph } from '@graphs';
import { env } from '@core';

describe('BuildTasksNode', () => {
  beforeAll(async () => { 
    if (env.REBUILD_SNAPSHOTS === 'true') {
      console.log("Rebuilding snapshots");
      await DatabaseSnapshotter.restoreSnapshot("basic_account");

      const result = await testGraph()
          .withGraph(routerGraph)
          .withPrompt(`Create a website about space exploration`)
          .execute();

      await DatabaseSnapshotter.createSnapshot("space_exploration");
    } else {
      console.log(`Not rebuilding snapshots`)
      await DatabaseSnapshotter.restoreSnapshot("space_exploration")
    }
  });

  describe('Basic Functionality', () => {
    it('correctly builds tasks based on user input', async () => {
      const result = await testGraph()
        .withGraph(routerGraph)
        .withWebsite('space-quest')
        .withPrompt(`Add a pricing section`)
        .stopAfter('buildTasks')
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.state).toBeDefined();
      expect(result.state.queue).toBeDefined();
      expect(Array.isArray(result.state.queue)).toBe(true);
      expect(result.state.queue.length).toBeGreaterThan(0);
      
      // Check task structure
      const firstTask = result.state.queue[0];
      expect(firstTask).toHaveProperty('id');
      expect(firstTask).toHaveProperty('title');
      expect(firstTask).toHaveProperty('instructions');
      expect(firstTask).toHaveProperty('path');
      expect(firstTask).toHaveProperty('status');
      expect(firstTask).toHaveProperty('type');
    });
  });
});