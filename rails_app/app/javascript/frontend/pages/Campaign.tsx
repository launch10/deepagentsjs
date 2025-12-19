import Sidebar from "@components/ads/Sidebar";
import AdCampaignTabSwitcher from "@components/ads/AdCampaignTabSwitcher";
import LogoSpinner from "@components/ui/logo-spinner";
import { useAdsChatIsLoadingHistory } from "@hooks/useAdsChat";
import AdPreview from "@components/ads/AdPreview";
import AdsForm from "@components/ads/forms/AdsForm";
import AdCampaignPagination from "@components/ads/AdCampaignPagination";
import { useEffect } from "react";

export default function Campaign() {
  const isLoadingHistory = useAdsChatIsLoadingHistory();

  return (
    <main className="mx-auto container max-w-7xl grid grid-cols-[288px_1fr] gap-8 px-8">
      <div>
        <Sidebar />
      </div>
      <div className="max-w-[948px]">
        <AdPreview className="mb-8" />
        <AdCampaignTabSwitcher />
        {isLoadingHistory ? (
          <div className="border-[#D3D2D0] border border-t-0 rounded-b-2xl bg-white">
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
