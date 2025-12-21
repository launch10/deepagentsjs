import { useEffect, useEffectEvent, useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import type { CampaignProps } from "@components/ads/sidebar/workflow-buddy/ad-campaign.types";
import { Workflow, type UUIDType, isUndefined, Ads } from "@shared";

export function useStageInit(stage: Workflow.AdCampaignSubstepName) {
  const { project } = usePage<CampaignProps>().props;
  const { updateState } = useAdsChatActions();
  const headlines = useAdsChatState("headlines");
  const descriptions = useAdsChatState("descriptions");
  const callouts = useAdsChatState("callouts");
  const structuredSnippets = useAdsChatState("structuredSnippets");
  const keywords = useAdsChatState("keywords");
  const assets = useMemo(
    () => ({
      headlines,
      descriptions,
      callouts,
      structuredSnippets,
      keywords,
    }),
    [headlines, descriptions, callouts, structuredSnippets, keywords]
  );
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
