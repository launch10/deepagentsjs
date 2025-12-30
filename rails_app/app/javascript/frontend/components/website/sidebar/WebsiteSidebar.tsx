import { Card } from "@components/ui/card";
import { Separator } from "@components/ui/separator";
import QuickActions from "./quick-actions/QuickActions";
import WebsiteChat from "./WebsiteChat";
import WebsiteSidebarLoading from "./loading/WebsiteSidebarLoading";

export interface WebsiteSidebarViewProps {
  isLoading?: boolean;
  currentStep?: number;
}

export function WebsiteSidebarView({
  isLoading = false,
  currentStep = 0,
}: WebsiteSidebarViewProps) {
  return (
    <Card className="shadow-[0px_0px_8px_4px_rgba(167,165,161,0.08)] bg-background border-neutral-300 rounded-2xl sticky top-24 z-0 py-0 gap-0">
      {isLoading ? (
        <WebsiteSidebarLoading currentStep={currentStep} />
      ) : (
        <>
          <QuickActions />
          <Separator className="bg-neutral-300" />
          <WebsiteChat />
        </>
      )}
    </Card>
  );
}

export default function WebsiteSidebar() {
  // TODO: Wire up to actual state management for isLoading and currentStep
  return <WebsiteSidebarView isLoading={false} />;
}
