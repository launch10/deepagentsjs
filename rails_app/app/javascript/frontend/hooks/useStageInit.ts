import { useEffect } from "react";
import { usePage } from "@inertiajs/react";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import type { CampaignProps } from "~/components/ads/Sidebar/WorkflowBuddy/ad-campaign.types";
import { Workflow, type UUIDType } from "@shared";

export function useStageInit(stage: Workflow.AdCampaignStep) {
  const { project } = usePage<CampaignProps>().props;
  const { updateState } = useAdsChatActions();
  const hasStartedStep = useAdsChatState("hasStartedStep");

  useEffect(() => {
    if (!project?.uuid) return;
    if (hasStartedStep?.[stage]) return;

    updateState({
      stage,
      projectUUID: project.uuid as UUIDType,
    });
  }, [hasStartedStep, stage, project?.uuid, updateState]);
}
