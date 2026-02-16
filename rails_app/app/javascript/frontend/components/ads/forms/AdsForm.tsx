import { selectSubstep, useWorkflow } from "@context/WorkflowProvider";
import { Workflow } from "@shared";
import ContentForm from "./content-form/ContentForm";
import HighlightsForm from "./highlights-form/HighlightsForm";
import KeywordsForm from "./keywords-form/KeywordsForm";
import LaunchForm from "./launch-form/LaunchForm";
import ReviewForm from "./review-form/ReviewForm";
import SettingsForm from "./settings-form/SettingsForm";

const FORMS: Partial<Record<Workflow.AdsSubstepName, React.ComponentType>> = {
  content: ContentForm,
  highlights: HighlightsForm,
  keywords: KeywordsForm,
  settings: SettingsForm,
  launch: LaunchForm,
  review: ReviewForm,
};

export default function AdsForm() {
  const substep = useWorkflow(selectSubstep);
  const FormComponent = substep ? FORMS[substep as Workflow.AdsSubstepName] : null;
  if (!FormComponent) return null;

  return <FormComponent />;
}
