import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { AdsGraphState } from "@state";
import { 
    campaigns as campaignsTable,
    projects as projectsTable,
    db,
    eq 
} from "@db";
import { CampaignAPIService } from "@services";
import { NodeMiddleware } from "@middleware";

export const createCampaign = NodeMiddleware.use({}, async (
    state: AdsGraphState,
    config?: LangGraphRunnableConfig
): Promise<Partial<AdsGraphState>> => {
    if (!state.stage) {
        throw new Error("Stage is required");
    }

    if (state.campaignId) {
        return {} // don't need to create
    }

    if (!state.projectUUID) {
        throw new Error("Project UUID is required");
    }

    if (!state.jwt) {
        throw new Error("JWT token is required for API authentication");
    }

    const projectResult = await db
        .select({ id: projectsTable.id, name: projectsTable.name })
        .from(projectsTable)
        .where(eq(projectsTable.uuid, state.projectUUID))
        .limit(1);

    if (!projectResult[0]) {
        throw new Error("Project not found");
    }

    const project = projectResult[0]!;

    const apiService = new CampaignAPIService({ jwt: state.jwt });
    const campaign = await apiService.create({
        name: project.name,
        projectId: project.id,
    });

    return {
        campaignId: campaign.id,
    };
});
