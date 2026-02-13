import { Card } from "@components/ui/card";
import DeployTaskList from "./DeployTaskList";
import type { Deploy } from "@shared";

interface DeploySidebarProps {
  deployType: "website" | "campaign";
  tasks?: Deploy.DeployGraphState["tasks"];
}

export default function DeploySidebar({ deployType, tasks }: DeploySidebarProps) {
  return (
    <Card className="shadow-[0px_0px_8px_4px_rgba(167,165,161,0.08)] bg-background border-neutral-300 rounded-2xl sticky top-24 z-0 py-0 gap-0 h-fit">
      <DeployTaskList deployType={deployType} tasks={tasks} />
    </Card>
  );
}
