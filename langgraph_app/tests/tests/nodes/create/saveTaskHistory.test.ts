import { describe, it, expect, beforeAll } from 'vitest';
import { testGraph } from '@support';
import { PageTypeEnum } from '@types';
import { PageModel, CodeTaskModel, ComponentOverviewModel } from '@models';
import { databaseSnapshotter } from '@services';
import { routerGraph } from '@graphs';

describe.sequential('SaveTaskHistoryNode', () => {
    beforeAll(async () => { 
        await databaseSnapshotter.restoreSnapshot("basic_account");
    });

    it('should save task history', async () => {
        const result = await testGraph()
            .withGraph(routerGraph)
            .withPrompt(`Create a website about space exploration`)
            .stopAfter('saveTaskHistory')
            .execute();

        expect(result.error).toBeUndefined();
        expect(result.state.taskHistory?.length).toEqual(result.state.completedTasks?.length);
    });
});
