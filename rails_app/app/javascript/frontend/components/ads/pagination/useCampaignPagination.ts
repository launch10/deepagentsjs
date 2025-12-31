import { useState, useCallback } from "react";
import {
  selectBack,
  selectCanGoBack,
  selectCanGoForward,
  selectContinue,
  selectSubstep,
  selectHasVisitedReview,
  selectReturnToReview,
  useWorkflowSteps,
} from "@context/WorkflowStepsProvider";
import { useAdvanceCampaign, useBackCampaign, useCampaignService } from "@api/campaigns.hooks";
import { selectValidateAndSave, useFormRegistry } from "@stores/formRegistry";
import { useAdsChatState } from "@hooks/useAdsChat";
import type { UpdateCampaignRequestBody } from "@api/campaigns";

export function useCampaignPagination() {
  const validateAndSave = useFormRegistry(selectValidateAndSave);
  const campaignId = useAdsChatState("campaignId");
  const service = useCampaignService();
  const [validationFailed, setValidationFailed] = useState(false);

  const substep = useWorkflowSteps(selectSubstep);
  const workflowContinue = useWorkflowSteps(selectContinue)!;
  const workflowBack = useWorkflowSteps(selectBack)!;
  const canGoBack = useWorkflowSteps(selectCanGoBack)!;
  const canGoForward = useWorkflowSteps(selectCanGoForward) || true;
  const hasVisitedReview = useWorkflowSteps(selectHasVisitedReview) ?? false;
  const returnToReview = useWorkflowSteps(selectReturnToReview)!;

  const showPrimaryAction = hasVisitedReview && substep !== "review";

  const { mutate: advanceCampaign, isPending: isAdvancing } = useAdvanceCampaign(campaignId);
  const { mutate: backCampaign, isPending: isGoingBack } = useBackCampaign(campaignId);

  const clearValidationFailed = useCallback(() => {
    setValidationFailed(false);
  }, []);

  const handleContinue = async () => {
    if (!substep || !campaignId) return;

    const result = await validateAndSave(substep, async (data) => {
      await service.update(campaignId, data as UpdateCampaignRequestBody);
    });

    if (!result.valid) {
      setValidationFailed(true);
      return;
    }

    advanceCampaign(undefined, {
      onSuccess: workflowContinue,
    });
  };

  const handleBack = () => {
    backCampaign(undefined, {
      onSuccess: workflowBack,
    });
  };

  return {
    handleBack,
    handleContinue,
    returnToReview,
    canGoBack,
    canGoForward,
    isPending: isAdvancing || isGoingBack,
    showPrimaryAction,
    validationFailed,
    clearValidationFailed,
  };
}
