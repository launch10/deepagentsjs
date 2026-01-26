import { User } from "lucide-react";

export function EmptyLeads() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6" data-testid="empty-leads">
      <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
        <User className="h-8 w-8 text-neutral-400" />
      </div>
      <h3 className="text-lg font-medium text-base-900 mb-2">No leads yet</h3>
      <p className="text-sm text-base-500 text-center max-w-md">
        You&apos;ve recently launched your project and have not received any leads yet. Check back
        soon.
      </p>
    </div>
  );
}
