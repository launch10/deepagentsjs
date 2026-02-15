import { useLayoutEffect, useRef, useState } from "react";
import { Card } from "@components/ui/card";
import DeployTaskList from "./DeployTaskList";
import { useDeployChatState } from "@hooks/useDeployChat";
import { useDeployInstructions } from "@hooks/useDeployInstructions";

export default function DeploySidebar() {
  const instructions = useDeployInstructions();
  const tasks = useDeployChatState("tasks");
  const contentRef = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState<number | undefined>();

  // Sidebar should be 3x the content height (content = 1/3, blank space = 2/3)
  useLayoutEffect(() => {
    if (contentRef.current) {
      setMinHeight(contentRef.current.offsetHeight * 3);
    }
  }, [tasks]);

  return (
    <Card
      className="shadow-[0px_0px_8px_4px_rgba(167,165,161,0.08)] bg-background border-neutral-300 rounded-2xl py-0 gap-0"
      style={minHeight ? { minHeight } : undefined}
    >
      <div ref={contentRef}>
        <DeployTaskList instructions={instructions} tasks={tasks} />
      </div>
    </Card>
  );
}
