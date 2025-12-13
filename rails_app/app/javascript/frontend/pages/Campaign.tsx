import Sidebar from "@components/ads/Sidebar";
import AdCampaignTabSwitcher from "@components/ads/AdCampaignTabSwitcher";
import LogoSpinner from "@components/ui/logo-spinner";
import { useAdsChatIsLoadingHistory } from "@hooks/useAdsChat";
import AdPreview from "@components/ads/AdPreview";
import AdsForm from "@components/ads/Forms/AdsForm";
import AdCampaignPagination from "@components/ads/AdCampaignPagination";

export default function Campaign() {
  const isLoadingHistory = useAdsChatIsLoadingHistory();

  return (
    <main className="mx-auto container max-w-6xl grid grid-cols-12 gap-10 px-5">
      <div className="col-span-4">
        <Sidebar />
      </div>
      <div className="col-span-8">
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
