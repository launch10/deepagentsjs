import { describe, it, expect, beforeAll, vi } from 'vitest';
import { testGraph } from '@support';
import { databaseSnapshotter } from '@services';
import { routerGraph } from '@graphs';
import { WebsiteModel } from '@models';

describe.sequential('PickTheme Node', () => {
    beforeAll(async () => {
        vi.resetModules();
        await databaseSnapshotter.restoreSnapshot("basic_account");
    });

    it('should pick a theme', async () => {
        const result = await testGraph()
            .withGraph(routerGraph)
            .withPrompt(`Create a website about space exploration`)
            .withServiceSpy(['PickThemeService'])
            .stopAfter('pickTheme')
            .execute();

        const themeOutput = result.serviceSpy?.get("PickThemeService")?.[0] as PickThemeOutputType;

        expect(result.error).toBeUndefined();
        const website = await WebsiteModel.find(result.state.website.id);
        expect(website.themeId).toBeGreaterThan(0);
        expect(website.themeId).toEqual(themeOutput.theme.id);
    });
});