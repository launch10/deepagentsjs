import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import { usePage } from "@inertiajs/react";
import { useAdsChatState, useAdsChatActions } from "@components/ads/hooks";
import type { CampaignProps } from "@components/ads/workflow-panel/workflow-buddy/ad-campaign.types";
import { Workflow, type UUIDType, Ads } from "@shared";

export function useStageInit(stage: Workflow.AdsSubstepName) {
  const { project } = usePage<CampaignProps>().props;
  const { updateState, setState } = useAdsChatActions();
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
  const attemptCount = useRef(0);

  // Reset attempt counter when navigating to a different stage
  useEffect(() => {
    attemptCount.current = 0;
  }, [stage]);

  // Always track current stage in SDK state (lightweight, no graph run).
  // This ensures the next graph invocation (refresh, user message) knows
  // which page the user is on — even if useStageInit skipped generation.
  useEffect(() => {
    setState({ stage });
  }, [stage, setState]);

  const maybeInitializeStage = useEffectEvent(() => {
    if (isGenerating.current) return;
    if (hasStartedStep && Ads.stageLoadedSuccessfully(assets, stage)) return;
    if (!project?.uuid) return;
    // Prevent infinite retry loop: if we've already attempted generation
    // and assets still haven't loaded, don't keep retrying automatically.
    if (attemptCount.current >= 1) return;
    isGenerating.current = true;
    attemptCount.current += 1;

    updateState({
      intent: {
        type: "switch_page" as const,
        payload: { stage },
        createdAt: new Date().toISOString(),
      },
      projectUUID: project.uuid as UUIDType,
    }).finally(() => {
      isGenerating.current = false;
    });
  });

  useEffect(() => {
    maybeInitializeStage();
  }, [hasStartedStep, stage, project?.uuid]);
}
