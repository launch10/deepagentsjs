import { useEffect, useEffectEvent } from "react";
import { usePage } from "@inertiajs/react";
import { useAdsChatState, useAdsChatActions, useAdsChat } from "@hooks/useAdsChat";
import type { CampaignProps } from "@components/ads/Sidebar/WorkflowBuddy/ad-campaign.types";
import { Workflow, type UUIDType, isUndefined, Ads } from "@shared";

export function useStageInit(stage: Workflow.AdCampaignSubstepName) {
  const { project } = usePage<CampaignProps>().props;
  const { updateState } = useAdsChatActions();
  const assets = useAdsChat((s) => ({
    headlines: s.state.headlines,
    descriptions: s.state.descriptions,
    callouts: s.state.callouts,
    structuredSnippets: s.state.structuredSnippets,
    keywords: s.state.keywords
  }))
  const hasStartedStep = useAdsChatState("hasStartedStep")?.[stage];

  const maybeInitializeStage = useEffectEvent(() => {
    if (hasStartedStep && Ads.stageLoadedSuccessfully(assets, stage)) return;
    if (!project?.uuid) return;

    updateState({
      stage,
      projectUUID: project.uuid as UUIDType,
    });
  });

  useEffect(() => {
    maybeInitializeStage();
  }, [hasStartedStep, stage, project?.uuid]);
}
