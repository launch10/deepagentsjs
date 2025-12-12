import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import Sidebar from "@components/ads/Sidebar";
import AdCampaignHighlights from "@components/ads/ad-campaign-create/ad-campaign-highlights";
import AdCampaignTabSwitcher from "@components/ads/ad-campaign-tab-switcher";
import type { CampaignProps } from "@components/ads/ad-campaign.types";
import LogoSpinner from "@components/ui/logo-spinner";
import { Ads, type UUIDType } from "@shared";
import { useAdsChatActions, useAdsChatState, useAdsChatIsLoadingHistory } from "@hooks/useAdsChat";
import AdPreview from "@components/ads/AdPreview";
import ContentPage from "@components/ads/ContentPage";
import Footer from "@components/ads/Footer";

const TABS = [
  { id: "content", label: "Content" },
  { id: "highlights", label: "Highlights" },
];

function useInitialStageUpdate() {
  const { campaign, workflow, project } = usePage<CampaignProps>().props;
  const campaignExists = Boolean(campaign?.id);

  const { updateState } = useAdsChatActions();
  const hasStartedStep = useAdsChatState("hasStartedStep");

  useEffect(() => {
    if (!workflow || !workflow.substep || !project?.uuid) return;
    if (campaignExists && workflow.substep === "content") return;
    if (
      hasStartedStep &&
      workflow.substep in hasStartedStep &&
      hasStartedStep[workflow.substep as Ads.StageName] === true
    )
      return;

    updateState({
      stage: workflow.substep as Ads.StageName,
      projectUUID: project.uuid as UUIDType,
    });
  }, [workflow?.substep, hasStartedStep, campaignExists, project?.uuid, updateState]);
}

export default function Campaign() {
  const { workflow } = usePage<CampaignProps>().props;
  const [activeTab, setActiveTab] = useState("content");
  const isLoadingHistory = useAdsChatIsLoadingHistory();

  useInitialStageUpdate();

  const handleRefreshAllSuggestions = () => {
    console.log("refresh all suggestions");
  };

  const handleContinue = (data: { headlines: any[]; descriptions: any[] }) => {
    console.log("Continue with data:", data);
  };

  return (
    <main className="mx-auto container max-w-6xl grid grid-cols-12 gap-10 px-5">
      <div className="col-span-4">
        <Sidebar
          activeStep={workflow?.step || undefined}
          activeSubstep={workflow?.substep || undefined}
          onRefreshSuggestions={handleRefreshAllSuggestions}
        />
      </div>
      <div className="col-span-8">
        <AdPreview className="mb-8" />
        <AdCampaignTabSwitcher tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        {isLoadingHistory ? (
          <div className="border-[#D3D2D0] border border-t-0 rounded-b-2xl bg-white">
            <div className="flex items-center justify-center p-9">
              <LogoSpinner />
            </div>
          </div>
        ) : (
          <>
            {activeTab === "content" && <ContentPage />}
            {activeTab === "highlights" && <AdCampaignHighlights featuresFields={[]} />}
            <Footer onContinue={handleContinue} />
          </>
        )}
      </div>
    </main>
  );
}
