import { router } from "@inertiajs/react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";

interface NewProjectButtonProps {
  isCollapsed?: boolean;
}

export function NewProjectButton({ isCollapsed = false }: NewProjectButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // URL-as-truth: navigating changes URL, store derives state from URL
    router.visit("/projects/new");
  };

  return (
    <button
      onClick={handleClick}
      data-testid="new-project-link"
      className={twMerge(
        "flex items-center gap-3 text-white font-sans cursor-pointer",
        isCollapsed && "justify-center"
      )}
    >
      <span className="flex items-center justify-center w-6 h-6 shrink-0 bg-white rounded-full">
        <PlusIcon className="w-4 h-4" style={{ color: "#12183d" }} strokeWidth={2.5} />
      </span>
      {!isCollapsed && <span>New Project</span>}
    </button>
  );
}
