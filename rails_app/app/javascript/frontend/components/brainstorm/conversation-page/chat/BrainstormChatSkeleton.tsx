import { Skeleton } from "@components/ui/skeleton";

/**
 * Skeleton loader for the brainstorm chat.
 * Mimics the layout of an existing conversation with messages.
 */
export function BrainstormChatSkeleton() {
  return (
    <div className="flex flex-1 min-h-0">
      {/* Left sidebar skeleton - Brand Personalization Panel */}
      <div className="hidden lg:block p-4 shrink-0 w-64">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-24 w-full mb-3" />
        <Skeleton className="h-24 w-full" />
      </div>

      {/* Main chat area skeleton */}
      <div className="flex-1 flex flex-col min-h-0 p-4">
        {/* Message skeletons */}
        <div className="flex-1 space-y-6 overflow-hidden">
          {/* User message skeleton */}
          <div className="flex justify-end">
            <Skeleton className="h-16 w-3/4 max-w-xl rounded-2xl" />
          </div>

          {/* AI message skeleton */}
          <div className="flex justify-start">
            <div className="space-y-2 w-3/4 max-w-2xl">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          {/* Another user message skeleton */}
          <div className="flex justify-end">
            <Skeleton className="h-12 w-2/3 max-w-lg rounded-2xl" />
          </div>

          {/* Another AI message skeleton */}
          <div className="flex justify-start">
            <div className="space-y-2 w-3/4 max-w-2xl">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>

        {/* Input skeleton */}
        <div className="mt-4 pt-4 border-t border-neutral-200">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
