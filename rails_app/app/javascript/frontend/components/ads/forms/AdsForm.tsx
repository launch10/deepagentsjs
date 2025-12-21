import { selectSubstep, useWorkflowSteps } from "@context/WorkflowStepsProvider";
import { Workflow } from "@shared";
import ContentForm from "./ContentForm/ContentForm";
import HighlightsForm from "./HighlightsForm/HighlightsForm";
import KeywordsForm from "./KeywordsForm/KeywordsForm";
import LaunchForm from "./LaunchForm/LaunchForm";
import ReviewForm from "./ReviewForm/ReviewForm";
import SettingsForm from "./SettingsForm/SettingsForm";

const FORMS: Partial<Record<Workflow.AdCampaignSubstepName, React.ComponentType>> = {
  content: ContentForm,
  highlights: HighlightsForm,
  keywords: KeywordsForm,
  settings: SettingsForm,
  launch: LaunchForm,
  review: ReviewForm,
};

export default function AdsForm() {
  const substep = useWorkflowSteps(selectSubstep);
  const FormComponent = substep ? FORMS[substep as Workflow.AdCampaignSubstepName] : null;
  if (!FormComponent) return null;

  return <FormComponent />;
}
