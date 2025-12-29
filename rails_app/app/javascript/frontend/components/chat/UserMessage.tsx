import { twMerge } from "tailwind-merge";
import type { ReactNode } from "react";

export interface UserMessageProps {
  children: ReactNode;
  className?: string;
}

export function UserMessage({ children, className }: UserMessageProps) {
  return (
    <div className={twMerge("bg-neutral-100 rounded-2xl px-4 py-3 max-w-[80%] ml-auto", className)}>
      <p className="text-neutral-900 whitespace-pre-wrap text-sm">{children}</p>
    </div>
  );
}
