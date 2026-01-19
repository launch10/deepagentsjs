import { CardContent } from "@components/ui/card";
import { Button } from "@components/ui/button";

export type CopyOption = {
  id: string;
  label: string;
};

export interface ImproveCopyViewProps {
  options: CopyOption[];
  onOptionSelect?: (option: CopyOption) => void;
}

const defaultOptions: CopyOption[] = [
  { id: "professional", label: "Make tone more professional" },
  { id: "friendly", label: "Make tone more friendly" },
  { id: "shorter", label: "Make copy shorter" },
];

export function ImproveCopyView({ options, onOptionSelect }: ImproveCopyViewProps) {
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
  const handleOptionSelect = (option: CopyOption) => {
    // TODO: Wire up to actual state management / send message to chat
    console.log("Copy option selected:", option);
  };

  return <ImproveCopyView options={defaultOptions} onOptionSelect={handleOptionSelect} />;
}
