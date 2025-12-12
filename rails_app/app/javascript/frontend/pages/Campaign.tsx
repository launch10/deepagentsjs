import Sidebar from "@components/ads/Sidebar";
import AdCampaignTabSwitcher from "@components/ads/AdCampaignTabSwitcher";
import LogoSpinner from "@components/ui/logo-spinner";
import { useAdsChatIsLoadingHistory } from "@hooks/useAdsChat";
import AdPreview from "@components/ads/AdPreview";
import ContentForm from "@components/ads/Forms/ContentForm";
import HighlightsForm from "@components/ads/Forms/HighlightsForm";
import Footer from "@components/ads/Footer";
import {
  useWorkflowSteps,
  selectSubstep,
  selectSetSubstep,
  selectStep,
} from "@context/WorkflowStepsProvider";
import { Workflow } from "@shared";

const FORMS: Partial<Record<Workflow.AdCampaignStep, React.ComponentType>> = {
  content: ContentForm,
  highlights: HighlightsForm,
};

export default function Campaign() {
  const substep = useWorkflowSteps(selectSubstep);
  const isLoadingHistory = useAdsChatIsLoadingHistory();

  const FormComponent = substep ? FORMS[substep] : null;

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
            {FormComponent && <FormComponent />}
            <Footer />
          </>
        )}
      </div>
    </main>
  );
}
