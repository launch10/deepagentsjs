import { twMerge } from "tailwind-merge";
import { Skeleton } from "@components/ui/skeleton";
import { useAdsChatState } from "@hooks/useAdsChat";

export default function AdPreview({ className }: { className?: string }) {
  const headlines = useAdsChatState("headlines");
  const descriptions = useAdsChatState("descriptions");

  const previewHeadline =
    headlines
      ?.filter((h) => !h.rejected)
      .slice(0, 3)
      .map((h) => h.text)
      .join(" | ") || "";

  const previewDescription = descriptions?.find((d) => !d.rejected)?.text || "";

  return (
    <div
      className={twMerge(
        "w-full bg-linear-to-b from-neutral-50 to-white rounded-md border border-neutral-100 py-8 px-10 relative",
        className
      )}
    >
      <div className="absolute top-6 right-8 text-base-400 text-sm">Ad Preview</div>
      <div className="flex flex-col mb-2 gap-1">
        {!previewHeadline ? (
          <Skeleton className="w-52 h-6" />
        ) : (
          <h2 className="text-lg font-semibold text-primary-500">{previewHeadline}</h2>
        )}
        <Skeleton className="w-32 h-4" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="text-sm text-base-400">
          {!previewDescription ? <Skeleton className="w-full h-12" /> : previewDescription}
        </div>
        <div className="flex gap-4">
          <span className="text-sm text-primary-500">Book Now</span>
          <span className="text-sm text-primary-500">Learn More</span>
          <span className="text-sm text-primary-500">Photos Shoots</span>
        </div>
      </div>
    </div>
  );
}
