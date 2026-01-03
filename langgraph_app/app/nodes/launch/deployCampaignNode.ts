import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { interrupt } from "@langchain/langgraph";
import type { LaunchGraphState } from "@annotation";
import { JobRunAPIService } from "@shared";
import { NodeMiddleware } from "@middleware";
import { env } from "@core";

export const deployCampaignNode = NodeMiddleware.use(
  {},
  async (
    state: LaunchGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<LaunchGraphState>> => {
    // If we have a job result from webhook callback, process it
    if (state.jobRunComplete) {
      if (state.jobRunComplete.status === "failed") {
        return {
          error: {
            message: state.jobRunComplete.error || "Campaign deployment failed",
            node: "deployCampaignNode",
          },
          deployStatus: "failed",
          jobRunComplete: undefined,
        };
      }

      return {
        deployResult: state.jobRunComplete.result,
        deployStatus: "completed",
        jobRunComplete: undefined,
      };
    }

    // Validate required state
    if (!state.jwt) {
      throw new Error("JWT token is required for API authentication");
    }

    if (!state.threadId) {
      throw new Error("Thread ID is required");
    }

    if (!state.campaignId) {
      throw new Error("Campaign ID is required");
    }

    // Trigger the job via Rails API
    const callbackUrl = `${env.LANGGRAPH_API_URL}/webhooks/job_run_callback`;
    const apiService = new JobRunAPIService({ jwt: state.jwt });

    const jobRun = await apiService.create({
      jobClass: "CampaignDeployWorker",
      arguments: { campaign_id: state.campaignId },
      threadId: state.threadId,
      callbackUrl,
    });

    // Interrupt and wait for webhook callback to resume
    return interrupt({
      reason: "waiting_for_job",
      jobRunId: jobRun.id,
      jobClass: "CampaignDeployWorker",
    });
  }
);
