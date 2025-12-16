import { Workflow } from "@shared";
import ContentForm from "./ContentForm/ContentForm";
import HighlightsForm from "./HighlightsForm/HighlightsForm";
import KeywordsForm from "./KeywordsForm/KeywordsForm";
import SettingsForm from "./SettingsForm/SettingsForm";
import {
  useWorkflowSteps,
  selectSubstep,
} from "@context/WorkflowStepsProvider";

const FORMS: Partial<Record<Workflow.AdCampaignSubstepName, React.ComponentType>> = {
  content: ContentForm,
  highlights: HighlightsForm,
  keywords: KeywordsForm,
  settings: SettingsForm,
};

export default function AdsForm() {
  const substep = useWorkflowSteps(selectSubstep);
  const FormComponent = substep ? FORMS[substep as Workflow.AdCampaignSubstepName] : null;
  if (!FormComponent) return;

  return <FormComponent />;
}
