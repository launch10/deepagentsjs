import { memo } from "react";
import { Markdown } from "./Markdown";

interface AssistantMessageProps {
  content: string;
  showChanges?: boolean;
}

export const AssistantMessage = memo(({ content, showChanges = false }: AssistantMessageProps) => {
  return (
    <div className="overflow-hidden w-full">
      <Markdown html showChanges={showChanges}>
        {content}
      </Markdown>
    </div>
  );
});
