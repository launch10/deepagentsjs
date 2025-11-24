import { describe, it, expect, beforeEach } from 'vitest';
import { testGraph } from '@support';
import { type AdsGraphState } from '@state';
import { adsGraph as uncompiledGraph } from '@graphs';
import { graphParams } from '@core';
import { DatabaseSnapshotter } from '@services';
import { db, projects as projectsTable } from '@db';
import { type UUIDType } from '@types';

const adsGraph = uncompiledGraph.compile({ ...graphParams, name: "ads" }); 

describe.sequential('Ads Flow', () => {
    let projectUUID: UUIDType;
    beforeEach(async () => {
        await DatabaseSnapshotter.restoreSnapshot("basic_account");
        projectUUID = await db.select().from(projectsTable).limit(1).execute().then((res) => {
            debugger;
            if (!res[0]) {
                throw new Error("No projects found");
            }
            return res[0]!.uuid as UUIDType;
        });
    }, 30000)

    describe("Chat flow", () => {
        it("automatically sends an initial agent message and populates initial headlines", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID
                })
                .withPrompt(`Sorry, what's going on?`)
                .execute();

            expect(result.state.error).toBeDefined();
            expect(result.state.error!.message).toContain("Project UUID is required");
        });
    });
});