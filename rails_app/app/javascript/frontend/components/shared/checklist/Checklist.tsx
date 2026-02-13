import { CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { Spinner } from "@components/ui/spinner";
import type { ReactNode } from "react";

export interface ChecklistRootProps {
  title: string;
  children: ReactNode;
}

/**
 * Checklist compound component — a titled list of items with status indicators.
 *
 * Usage:
 *   <Checklist.Root title="Launching Website">
 *     <Checklist.Items>
 *       <ChecklistItem icon={BugIcon} label="Checking for bugs" status="completed" />
 *       <ChecklistItem icon={RocketIcon} label="Launching website" status="in_progress" />
 *     </Checklist.Items>
 *   </Checklist.Root>
 *
 *   <Checklist.Root title="Landing Page Designer">
 *     <Checklist.Empty message="Planning your website..." />
 *   </Checklist.Root>
 */
function Root({ title, children }: ChecklistRootProps) {
  return (
    <CardHeader className="px-4 py-4">
      <CardTitle className="text-lg font-semibold font-serif">{title}</CardTitle>
      <CardDescription className="flex flex-col gap-2 pt-1">{children}</CardDescription>
    </CardHeader>
  );
}

function Items({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 h-10 px-3 rounded-lg border border-neutral-300 bg-white">
      <Spinner className="size-4" />
      <span className="text-xs text-base-500">{message}</span>
    </div>
  );
}

export const Checklist = { Root, Items, Empty };
export default Checklist;
