import { cn } from "@lib/utils";
import type { LucideIcon } from "lucide-react";
import { Button } from "@components/ui/button";

export interface QuickActionButtonProps {
  label: string;
  icon: LucideIcon;
  iconColor?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export default function QuickActionButton({
  label,
  icon: Icon,
  iconColor = "text-base-500",
  isActive = false,
  onClick,
}: QuickActionButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      size="sm"
      className={cn(
        "justify-start bg-white border-neutral-300",
        isActive ? "border-base-600" : "hover:border-neutral-500"
      )}
    >
      <Icon className={cn("size-5", iconColor)} />
      <span>{label}</span>
    </Button>
  );
}
