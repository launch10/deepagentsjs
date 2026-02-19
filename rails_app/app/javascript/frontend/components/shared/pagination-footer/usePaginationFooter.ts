import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  selectBack,
  selectCanGoBack,
  selectCanGoForward,
  selectContinue,
  selectSubstep,
  selectHasVisitedReview,
  selectReturnToReview,
  useWorkflow,
} from "@context/WorkflowProvider";
import { useAdvanceCampaign, useBackCampaign, useCampaignService } from "@components/ads/hooks";
import { selectValidateAndSave, useFormRegistry } from "@stores/formRegistry";
import { useAdsChatState } from "@components/ads/hooks";
import type { UpdateCampaignRequestBody } from "@rails_api_base";

export function usePaginationFooter() {
  const validateAndSave = useFormRegistry(selectValidateAndSave);
  const campaignId = useAdsChatState("campaignId");
  const service = useCampaignService();
  const [validationFailed, setValidationFailed] = useState(false);

  const substep = useWorkflow(selectSubstep);
  const workflowContinue = useWorkflow(selectContinue);
  const workflowBack = useWorkflow(selectBack);
  const canGoBack = useWorkflow(selectCanGoBack);
  const canGoForward = useWorkflow(selectCanGoForward);
  const hasVisitedReview = useWorkflow(selectHasVisitedReview);
  const returnToReview = useWorkflow(selectReturnToReview);

  const showPrimaryAction = hasVisitedReview && substep !== "review";

  const { mutate: advanceCampaign, isPending: isAdvancing } = useAdvanceCampaign(campaignId);
  const { mutate: backCampaign, isPending: isGoingBack } = useBackCampaign(campaignId);

  const clearValidationFailed = useCallback(() => {
    setValidationFailed(false);
  }, []);

  const handleContinue = async () => {
    if (!substep || !campaignId) {
      console.warn("[PaginationFooter] handleContinue aborted: substep=%s, campaignId=%s", substep, campaignId);
      return;
    }

    const result = await validateAndSave(substep, async (data) => {
      await service.update(campaignId, data as UpdateCampaignRequestBody);
    });

    console.log("[PaginationFooter] validateAndSave result:", result);

    if (!result.valid) {
      if (result.error) {
        toast.error(result.error.message || "Failed to save. Please try again.");
      }
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
