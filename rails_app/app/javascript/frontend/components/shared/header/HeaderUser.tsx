import { CircleUserIcon } from "lucide-react";
import { usePage } from "@inertiajs/react";
import { twMerge } from "tailwind-merge";

interface PageProps {
  current_user?: {
    id: number;
    name: string;
    email: string;
  };
}

function formatUserName(user: PageProps["current_user"]): string {
  if (!user) return "";
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  }
  return user.email.split("@")[0];
}

export default function HeaderUser({ className }: { className?: string }) {
  const { current_user } = usePage<{ props: PageProps }>().props as PageProps;

  return (
    <div
      className={twMerge(
        "flex items-center text-[#74767A] text-sm relative z-20 bg-background pl-4",
        className
      )}
    >
      <CircleUserIcon className="mr-2" />
      {formatUserName(current_user)}
    </div>
  );
}
