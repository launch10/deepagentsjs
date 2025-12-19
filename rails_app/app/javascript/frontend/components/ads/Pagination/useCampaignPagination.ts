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
import { useAdvanceCampaign, useBackCampaign } from "@api/campaigns.hooks";
import { selectValidate, selectSave, useFormRegistry } from "@stores/formRegistry";
import { useAdsChatState } from "@hooks/useAdsChat";

export function useCampaignPagination() {
  const validateForm = useFormRegistry(selectValidate);
  const saveForm = useFormRegistry(selectSave);
  const campaignId = useAdsChatState("campaignId");

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

    try {
      await saveForm(substep);
    } catch {
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
  };
}
