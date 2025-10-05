import { describe, it, expect } from 'vitest';
import { testGraph } from '@support';
import { routerGraph } from '@graphs';

describe.sequential('NameProject Node Test', () => {
    it('should generate project name', async () => {
        const result = await testGraph()
            .withGraph(routerGraph)
            .withPrompt("Create a cool website about dogs with animations")
            .stopAfter('nameProject')
            .execute();

        expect(result.error).toBeUndefined();
        expect(result.state.projectName).toBeDefined();
        expect(typeof result.state.projectName).toBe('string');
    });
});