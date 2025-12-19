import Sidebar from "@components/ads/Sidebar";
import AdCampaignTabSwitcher from "@components/ads/AdCampaignTabSwitcher";
import LogoSpinner from "@components/ui/logo-spinner";
import { useAdsChatIsLoadingHistory } from "@hooks/useAdsChat";
import AdPreview from "@components/ads/AdPreview";
import AdsForm from "@components/ads/forms/AdsForm";
import AdCampaignPagination from "@components/ads/AdCampaignPagination";
import { selectSubstep, useWorkflowSteps } from "@context/WorkflowStepsProvider";
import { cn } from "@lib/utils";

export default function Campaign() {
  const isLoadingHistory = useAdsChatIsLoadingHistory();
  const substep = useWorkflowSteps(selectSubstep);
  const shouldHideTabSwitcher = substep === "launch" || substep === "review"; // Hide tab switcher on Launch/Review steps

  return (
    <main className="mx-auto container max-w-7xl grid grid-cols-[288px_1fr] gap-8 px-8">
      <div>
        <Sidebar />
      </div>
      <div className="max-w-[948px]">
        <AdPreview className="mb-8" />
        {!shouldHideTabSwitcher && <AdCampaignTabSwitcher disabled={isLoadingHistory} />}
        {isLoadingHistory ? (
          <div
            className={cn(
              "border-[#D3D2D0] border rounded-2xl bg-white",
              !shouldHideTabSwitcher && "rounded-t-none"
            )}
          >
            <div className="flex items-center justify-center p-9">
              <LogoSpinner />
            </div>
          </div>
        ) : (
          <>
            <AdsForm />
            <AdCampaignPagination />
          </>
        )}
      </div>
    </main>
  );
}
