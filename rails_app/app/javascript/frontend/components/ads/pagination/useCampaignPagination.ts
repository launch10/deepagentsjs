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
import { selectValidate, selectCollectData, useFormRegistry } from "@stores/formRegistry";
import { useAdsChatState } from "@hooks/useAdsChat";
import type { UpdateCampaignRequestBody } from "@api/campaigns";

export function useCampaignPagination() {
  const validateForm = useFormRegistry(selectValidate);
  const collectData = useFormRegistry(selectCollectData);
  const campaignId = useAdsChatState("campaignId");
  const service = useCampaignService();

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

  const handleContinue = async () => {
    if (!substep) return;

    const isValid = await validateForm(substep);
    if (!isValid) return;

    // Collect and merge all form data, then send a single API call
    const mergedData = collectData(substep);
    if (mergedData && campaignId) {
      try {
        await service.update(campaignId, mergedData as UpdateCampaignRequestBody);
      } catch {
        return;
      }
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
  };
}
