import { Button } from "@components/ui/button";
import { twMerge } from "tailwind-merge";

export default function AdCampaignPagination({
  className,
  canContinue = true,
}: {
  className?: string;
  canContinue?: boolean;
}) {
  return (
    <div
      className={twMerge(
        "sticky bottom-0 mt-3",
        "bg-background flex justify-between items-center border-t border-[#E2E1E0] py-4 px-6 shadow-[9px_-16px_26.1px_1px_#74767A12]",
        className
      )}
    >
      <Button variant="link">Previous Step</Button>
      {/* TODO: Make right buttons children prop  */}
      <Button disabled={!canContinue}>Continue</Button>
    </div>
  );
}
