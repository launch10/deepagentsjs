import { Card } from "@components/ui/card";
import { Separator } from "@components/ui/separator";
import WorkflowBuddy from "./Sidebar/WorkflowBuddy";
import AdsChat from "./Sidebar/AdsChat";

export default function AdsSidebar({
  activeStep,
  activeSubstep,
}: {
  activeStep?: string;
  activeSubstep?: string;
}) {
  return (
    <Card className="shadow-none bg-background border-neutral-300 rounded-2xl sticky top-24 z-0">
      <WorkflowBuddy activeStep={activeStep} activeSubstep={activeSubstep} />
      <Separator className="bg-neutral-300" />
      <AdsChat />
    </Card>
  );
}
