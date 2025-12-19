import { Button } from "@components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@lib/utils";

interface RefreshSuggestionsButtonProps {
  className?: string;
  onClick: () => void;
}
export default function RefreshSuggestionsButton({
  className,
  onClick,
}: RefreshSuggestionsButtonProps) {
  return (
    <Button
      type="button"
      variant="link"
      className={cn("text-base-400 font-normal text-xs", className)}
      onClick={onClick}
    >
      <Sparkles /> Refresh Suggestions
    </Button>
  );
}
