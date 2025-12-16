import { Card } from "@components/ui/card";
import { Separator } from "@components/ui/separator";
import WorkflowBuddy from "./Sidebar/WorkflowBuddy";
import AdsChat from "./Sidebar/AdsChat";

export default function AdsSidebar() {
  return (
    <Card className="shadow-[0px_0px_8px_4px_rgba(167,165,161,0.08)] bg-background border-neutral-300 rounded-2xl sticky top-24 z-0 py-0 gap-0">
      <WorkflowBuddy />
      <Separator className="bg-neutral-300" />
      <AdsChat />
    </Card>
  );
}