import { router } from "@inertiajs/react";
import { usePage } from "@inertiajs/react";
import { Button } from "@components/ui/button";

interface DeployFooterProps {
  isComplete: boolean;
}

export default function DeployFooter({ isComplete }: DeployFooterProps) {
  const { project } = usePage<{ project: { uuid: string } }>().props;

  return (
    <div className="flex items-center justify-end gap-3">
      <Button
        variant="outline"
        disabled={!isComplete}
        onClick={() => router.visit(`/projects/${project.uuid}`)}
      >
        View Dashboard
      </Button>
      <Button
        disabled={!isComplete}
        onClick={() => router.visit(`/projects/${project.uuid}/performance`)}
      >
        Review Performance
      </Button>
    </div>
  );
}
