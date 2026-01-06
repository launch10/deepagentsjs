import { Button } from "@components/ui/button";
import { TextShimmer } from "@components/ui/text-shimmer";
import { useAdsChatIsStreaming } from "@components/ads/hooks";
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
  const isStreaming = useAdsChatIsStreaming();

  return (
    <Button
      type="button"
      variant="link"
      className={cn("text-base-400 font-normal text-xs", className)}
      onClick={onClick}
      data-testid="refresh-suggestions-button"
    >
      <Sparkles />{" "}
      {isStreaming ? <TextShimmer>Refresh Suggestions</TextShimmer> : "Refresh Suggestions"}
    </Button>
  );
}
