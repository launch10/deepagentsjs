import { evalite } from 'evalite';
import { testGraph } from '@support';
import { type AdsGraphState } from '@state';
import { adsGraph as uncompiledGraph } from '@graphs';
import { graphParams } from '@core';
import { DatabaseSnapshotter } from '@services';
import { db, projects as projectsTable } from '@db';
import { type UUIDType } from '@types';
import { HumanMessage } from '@langchain/core/messages';
import { FollowsUserRequestScorer } from '@tests/support/evals';
import { disablePolly } from '@utils';

disablePolly();

const adsGraph = uncompiledGraph.compile({ ...graphParams, name: "ads" });

interface HeadlineRefreshInput {
    projectUUID: UUIDType;
    userRequest: string;
}

interface HeadlineRefreshOutput {
    originalHeadlines: string[];
    newHeadlines: string[];
}

evalite('Ads', {
    data: async () => {
        await DatabaseSnapshotter.restoreSnapshot("campaign_created");
        const projectUUID = await db.select().from(projectsTable).limit(1).execute().then((res) => {
            if (!res[0]) {
                throw new Error("No projects found");
            }
            return res[0]!.uuid as UUIDType;
        });

        return [
            {
                input: {
                    projectUUID,
                    userRequest: "I want more playful, funny headlines"
                }
            },
            {
                input: {
                    projectUUID,
                    userRequest: "Make the headlines more professional and corporate"
                }
            },
            {
                input: {
                    projectUUID,
                    userRequest: "I want headlines that create urgency and FOMO"
                }
            }
        ];
    },
    task: async (input: HeadlineRefreshInput): Promise<HeadlineRefreshOutput> => {
        const result = await testGraph<AdsGraphState>()
            .withGraph(adsGraph)
            .withState({
                projectUUID: input.projectUUID,
                stage: "content",
            })
            .execute();

        const refreshedResult = await testGraph<AdsGraphState>()
            .withGraph(adsGraph)
            .withState({
                ...result.state,
                messages: [
                    ...result.messages,
                    new HumanMessage(input.userRequest)
                ]
            })
            .execute();

        const originalHeadlines = result.state.headlines || [];
        const allHeadlines = refreshedResult.state.headlines || [];
        const originalTexts = new Set(originalHeadlines.map(h => h.text));
        const newHeadlines = allHeadlines.filter(h => !h.rejected && !originalTexts.has(h.text));

        return {
            originalHeadlines: originalHeadlines.map((h) => h.text),
            newHeadlines: newHeadlines.map((h) => h.text)
        };
    },
    scorers: [
        {
            name: "New headlines follow user request",
            scorer: async ({ output, input }: { output: HeadlineRefreshOutput, input: HeadlineRefreshInput }) => {
                return await FollowsUserRequestScorer({
                    input: input.userRequest,
                    originalContent: output.originalHeadlines.join('\n'),
                    output: output.newHeadlines.join('\n'),
                    userRequest: input.userRequest,
                    useCoT: true
                });
            }
        }
    ]
});
