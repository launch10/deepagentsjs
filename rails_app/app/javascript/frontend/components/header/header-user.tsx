import { CircleUserIcon } from "lucide-react";
import { twMerge } from "tailwind-merge";

export default function HeaderUser({ className }: { className?: string }) {
  return (
    <div
      className={twMerge("flex items-center text-[#74767A] text-sm", className)}
    >
      <CircleUserIcon className="mr-2" />
      Alex T.
    </div>
  );
}
