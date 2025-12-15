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
        "w-full bg-white rounded-xl py-8 pl-10 pr-16 relative overflow-hidden",
        className
      )}
    >
      <div 
        className="absolute inset-0 rounded-2xl border border-neutral-200/50 pointer-events-none"
        style={{ backgroundImage: "linear-gradient(180deg, rgba(237, 237, 236, 0.2) 0%, rgba(237, 237, 236, 0) 100%)" }}
      />
      <div className="absolute top-6 right-8 text-base-400 text-sm">Ad Preview</div>
      <div className="max-w-[calc(100%-100px)]">
        <div className="flex flex-col mb-2 gap-2">
          {!previewHeadline ? (
            <Skeleton className="w-52 h-6" />
          ) : (
            <h2 className="text-xl font-medium text-primary-500 font-roboto break-words">{previewHeadline}</h2>
          )}
          <Skeleton className="w-32 h-4 text-success-700" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="text-sm text-base-400 leading-[18px] break-words">
            {!previewDescription ? <Skeleton className="w-full h-12" /> : previewDescription}
          </div>
          <div className="flex gap-6 flex-wrap">
            <span className="text-sm text-primary-500">Book Now</span>
            <span className="text-sm text-primary-500">Learn More</span>
            <span className="text-sm text-primary-500">Photo Shoots</span>
          </div>
        </div>
      </div>
    </div>
  );
}
