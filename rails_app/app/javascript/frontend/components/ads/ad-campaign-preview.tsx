import { twMerge } from "tailwind-merge";
import { Skeleton } from "@components/ui/skeleton";

export default function AdCampaignPreview({
  headline = "",
  url = "",
  details = "",
  className,
}: {
  headline?: string;
  url?: string;
  details?: string;
  className?: string;
}) {
  return (
    <div
      className={twMerge(
        "w-full bg-linear-to-b from-neutral-50 to-white rounded-md border border-neutral-100 py-8 px-10 relative",
        className
      )}
    >
      <div className="absolute top-6 right-8 text-base-400 text-sm">Ad Preview</div>
      <div className="flex flex-col mb-2 gap-1">
        {!headline ? (
          <Skeleton className="w-52 h-6" />
        ) : (
          <h2 className="text-lg font-semibold text-primary-500">{headline}</h2>
        )}
        {!url ? (
          <Skeleton className="w-32 h-4" />
        ) : (
          <h3 className="text-sm font-normal text-success-500">{url}</h3>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <div className="text-sm text-base-400">
          {!details ? <Skeleton className="w-full h-12" /> : details}
        </div>
        <div className="flex gap-4">
          {/* TODO: Sitelinks */}
          <span className="text-sm text-primary-500">Book Now</span>
          <span className="text-sm text-primary-500">Learn More</span>
          <span className="text-sm text-primary-500">Photos Shoots</span>
        </div>
      </div>
    </div>
  );
}
