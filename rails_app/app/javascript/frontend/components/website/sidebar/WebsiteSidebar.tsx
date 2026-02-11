import { Card } from "@components/ui/card";
import { Separator } from "@components/ui/separator";
import QuickActions from "./quick-actions/QuickActions";
import WorkflowBuddy from "@components/ads/workflow-panel/WorkflowBuddy";
import WebsiteChat from "./WebsiteChat";
import CreateFlowTodoList from "./create-flow/CreateFlowTodoList";
import { useWebsiteChatIsInitialLoading } from "@hooks/website";
import type { Workflow } from "@shared";

export interface WebsiteSidebarProps {
  substep?: Workflow.WebsiteSubstepName;
  chatLocked?: boolean;
}

export default function WebsiteSidebar({
  substep = "build",
  chatLocked = false,
}: WebsiteSidebarProps) {
  const isInitialLoading = useWebsiteChatIsInitialLoading();

  // Show workflow buddy (steps) for domain and deploy substeps
  // Show quick actions for build substep
  const showWorkflowBuddy = substep === "domain" || substep === "deploy";

  return (
    <Card className="shadow-[0px_0px_8px_4px_rgba(167,165,161,0.08)] bg-background border-neutral-300 rounded-2xl z-0 py-0 gap-0 h-full w-full flex flex-col">
      {isInitialLoading ? (
        <CreateFlowTodoList />
      ) : (
        <>
          {showWorkflowBuddy ? <WorkflowBuddy workflowStep="website" /> : <QuickActions />}
          <Separator className="bg-neutral-300" />
          <WebsiteChat locked={chatLocked} />
        </>
      )}
    </Card>
  );
}
