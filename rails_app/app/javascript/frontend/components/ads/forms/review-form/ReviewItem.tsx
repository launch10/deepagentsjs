import { Separator } from "@components/ui/separator";
import { cn } from "@lib/utils";
import * as React from "react";

export interface ReviewItemProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function ReviewItem({ label, children, className }: ReviewItemProps) {
  return (
    <div className={cn("flex justify-between items-center py-3", className)}>
      <div className="text-sm font-semibold text-base-500">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export interface ReviewItemListProps {
  children: React.ReactNode;
  className?: string;
}

export function ReviewItemList({ children, className }: ReviewItemListProps) {
  const items = React.Children.toArray(children);

  return (
    <div className={className}>
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {child}
          {index < items.length - 1 && <Separator className="bg-neutral-300" />}
        </React.Fragment>
      ))}
    </div>
  );
}
