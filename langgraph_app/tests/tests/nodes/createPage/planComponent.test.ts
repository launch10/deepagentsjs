import { describe, it, expect, beforeAll, vi } from 'vitest';
import { testGraph } from '@support';
import { databaseSnapshotter } from '@utils';
import { codeTaskFactory, componentOverviewFactory } from '@factories';
import { ComponentContentPlanModel } from '@models';

describe.sequential('PlanComponentNode', () => {
    beforeAll(async () => { 
        await databaseSnapshotter.restoreSnapshot("basic_account");
    });

    it('plans component', async () => {
        // We put this down here because we need to mock the PlanPageService
        const { routerGraph } = await import('@graphs');

        const result = await testGraph()
            .withGraph(routerGraph)
            .withPrompt(`Create a website about space exploration`)
            .stopAfter('planComponent')
            .execute();

        expect(result.error).toBeUndefined();

        const overviews = result.state.componentOverviews;
        const heroOverview = overviews?.find((overview) => overview.componentType === 'Hero');
        
        const contentPlan = await ComponentContentPlanModel.findBy({
            componentOverviewId: heroOverview?.id,
        })

        expect(contentPlan).toBeDefined();
        expect(contentPlan?.data).toBeDefined();
        expect(contentPlan?.data.headline).toBeDefined();
        expect(contentPlan?.data.subheadline).toBeDefined();
        expect(contentPlan?.data.paragraphs).toBeDefined();
        expect(contentPlan?.data.suggestedComponents).toBeDefined();
        expect(contentPlan?.data.trustSignals).toBeDefined();
        expect(contentPlan?.data.visualConcept).toBeDefined();
        expect(contentPlan?.data.layoutVariant).toBeDefined();
        expect(contentPlan?.data.visualEmphasis).toBeDefined();
        expect(contentPlan.createdAt).not.toBeNull();
        expect(contentPlan.updatedAt).not.toBeNull();
    });
});