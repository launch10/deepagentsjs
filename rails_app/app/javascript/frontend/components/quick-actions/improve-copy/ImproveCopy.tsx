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
    <div className="flex flex-col gap-1.5">
      <div className="font-medium text-sm text-base-400">Update Copy</div>
      <div className="flex flex-col gap-2.5">
        {options.map((option) => (
          <Button
            key={option.id}
            variant="outline"
            size="sm"
            onClick={() => onOptionSelect?.(option)}
            disabled={disabled}
            className="w-full justify-start bg-white border-neutral-300 hover:border-neutral-500"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function ImproveCopy({ onSubmit }: { onSubmit?: () => void }) {
  const { sendMessage } = useWebsiteChatActions();
  const isStreaming = useWebsiteChatIsStreaming();

  const handleOptionSelect = (option: CopyOption) => {
    sendMessage(option.label, {
      intent: {
        type: "improve_copy",
        payload: { style: option.id },
        createdAt: new Date().toISOString(),
      },
    });
    onSubmit?.();
  };

  return (
    <ImproveCopyView
      options={defaultOptions}
      onOptionSelect={handleOptionSelect}
      disabled={isStreaming}
    />
  );
}
