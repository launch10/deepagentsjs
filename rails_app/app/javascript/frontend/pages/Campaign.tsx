import { usePage } from "@inertiajs/react";
import Sidebar from "@components/ads/Sidebar";
import AdCampaignTabSwitcher from "@components/ads/ad-campaign-tab-switcher";
import type { CampaignProps } from "@components/ads/ad-campaign.types";
import LogoSpinner from "@components/ui/logo-spinner";
import { useAdsChatIsLoadingHistory } from "@hooks/useAdsChat";
import AdPreview from "@components/ads/AdPreview";
import ContentForm from "@components/ads/Forms/ContentForm";
import HighlightsForm from "@components/ads/Forms/HighlightsForm";
import Footer from "@components/ads/Footer";
import {
  WorkflowStepsProvider,
  useWorkflowSteps,
  selectSubstep,
  selectSetSubstep,
  selectStep,
} from "@providers/WorkflowStepsProvider";
import { Workflow } from "@shared";

const TABS = [
  { id: "content", label: "Content" },
  { id: "highlights", label: "Highlights" },
];

const FORMS: Partial<Record<Workflow.AdCampaignStep, React.ComponentType>> = {
  content: ContentForm,
  highlights: HighlightsForm,
};

function CampaignContent() {
  const substep = useWorkflowSteps(selectSubstep);
  const step = useWorkflowSteps(selectStep);
  const setSubstep = useWorkflowSteps(selectSetSubstep);
  const isLoadingHistory = useAdsChatIsLoadingHistory();

  const FormComponent = substep ? FORMS[substep] : null;

  return (
    <main className="mx-auto container max-w-6xl grid grid-cols-12 gap-10 px-5">
      <div className="col-span-4">
        <Sidebar activeStep={step || undefined} activeSubstep={substep || undefined} />
      </div>
      <div className="col-span-8">
        <AdPreview className="mb-8" />
        <AdCampaignTabSwitcher
          tabs={TABS}
          activeTab={substep || "content"}
          onChange={(tab) => setSubstep(tab as Workflow.AdCampaignStep)}
        />
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

export default function Campaign() {
  const { workflow, project } = usePage<CampaignProps>().props;

  return (
    <WorkflowStepsProvider workflow={workflow} projectUUID={project?.uuid ?? null}>
      <CampaignContent />
    </WorkflowStepsProvider>
  );
}
