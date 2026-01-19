import { CheckCircleIcon } from "@heroicons/react/24/solid";

export default function PageOverview() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-gray-800 text-lg font-semibold">Your landing page is ready</span>
        <CheckCircleIcon className="size-4 text-success-500" />
      </div>
      <div className="text-base-300 text-xs">
        Here's a preview of your landing page. You can return to the previous step to make edits, or
        continue to set up and launch.
      </div>
    </div>
  );
}
