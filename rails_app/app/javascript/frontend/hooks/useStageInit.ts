import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import { usePage } from "@inertiajs/react";
import { useAdsChatState, useAdsChatActions } from "@components/ads/hooks";
import type { CampaignProps } from "@components/ads/workflow-panel/workflow-buddy/ad-campaign.types";
import { Workflow, type UUIDType, Ads } from "@shared";

export function useStageInit(stage: Workflow.AdsSubstepName) {
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
  const isGenerating = useRef(false);

  const maybeInitializeStage = useEffectEvent(() => {
    console.log("maybeInitializeStage", stage);
    console.log("hasStartedStep", hasStartedStep);
    console.log("Ads.stageLoadedSuccessfully", Ads.stageLoadedSuccessfully(assets, stage));
    console.log("projectUUID", project?.uuid);
    if (isGenerating.current) return;
    if (hasStartedStep && Ads.stageLoadedSuccessfully(assets, stage)) return;
    if (!project?.uuid) return;
    isGenerating.current = true;

    updateState({
      stage,
      projectUUID: project.uuid as UUIDType,
    }).finally(() => {
      isGenerating.current = false;
    });
  });

  useEffect(() => {
    maybeInitializeStage();
  }, [hasStartedStep, stage, project?.uuid]);
}
