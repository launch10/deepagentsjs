import { CardContent } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { useWebsiteChatActions, useWebsiteChatIsStreaming } from "@hooks/website";
import type { Website } from "@shared";

export type CopyOption = {
  id: Website.ImproveCopyStyle;
  label: string;
};

export interface ImproveCopyViewProps {
  options: CopyOption[];
  onOptionSelect?: (option: CopyOption) => void;
  disabled?: boolean;
}

const defaultOptions: CopyOption[] = [
  { id: "professional", label: "Make tone more professional" },
  { id: "friendly", label: "Make tone more friendly" },
  { id: "shorter", label: "Make copy shorter" },
];

export function ImproveCopyView({ options, onOptionSelect, disabled }: ImproveCopyViewProps) {
  return (
    <CardContent className="px-4 py-4 flex flex-col gap-3">
      <span className="text-xs font-medium text-base-400">Update Copy</span>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <Button
            key={option.id}
            variant="outline"
            size="sm"
            onClick={() => onOptionSelect?.(option)}
            disabled={disabled}
            className="justify-start bg-white border-neutral-300 hover:border-neutral-500"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </CardContent>
  );
}

export default function ImproveCopy() {
  const { updateState } = useWebsiteChatActions();
  const isStreaming = useWebsiteChatIsStreaming();

  const handleOptionSelect = (option: CopyOption) => {
    updateState({
      command: "improve_copy",
      improveCopyStyle: option.id,
    });
  };

  return (
    <ImproveCopyView
      options={defaultOptions}
      onOptionSelect={handleOptionSelect}
      disabled={isStreaming}
    />
  );
}
