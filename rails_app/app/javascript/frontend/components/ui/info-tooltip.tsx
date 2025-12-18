import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export default function InfoTooltip({
  text,
  side = "top",
  align = "center",
}: {
  text: string;
  side?: "right" | "left" | "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Info size={12} className="text-base-300" />
      </TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
