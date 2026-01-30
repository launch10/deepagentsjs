import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@lib/utils";
import type { PaginationMeta } from "@rails_api_base";

interface ProjectsPaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function ProjectsPagination({
  pagination,
  onPageChange,
  disabled = false,
}: ProjectsPaginationProps) {
  const { current_page, prev_page, next_page, series } = pagination;

  const linkClass = (isActive: boolean, isDisabled: boolean) =>
    cn(
      "inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
      isActive && "bg-base-500 text-white",
      !isActive && !isDisabled && "text-base-700 hover:bg-neutral-100 cursor-pointer",
      isDisabled && "text-neutral-400 cursor-not-allowed"
    );

  return (
    <div className="flex items-center justify-center gap-1 mt-4" data-testid="projects-pagination">
      {/* Previous */}
      {prev_page && !disabled ? (
        <button
          type="button"
          onClick={() => onPageChange(prev_page)}
          className={linkClass(false, false)}
          data-testid="pagination-prev"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </button>
      ) : (
        <span className={linkClass(false, true)} data-testid="pagination-prev-disabled">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </span>
      )}

      {/* Page numbers */}
      {series.map((item, index) => {
        if (item === "gap") {
          return (
            <span key={`gap-${index}`} className="px-2 text-base-400">
              ...
            </span>
          );
        }

        const pageNum = Number(item);
        const isActive = pageNum === current_page;

        if (disabled) {
          return (
            <span
              key={pageNum}
              className={linkClass(false, true)}
              data-testid={`pagination-page-${pageNum}`}
            >
              {pageNum}
            </span>
          );
        }

        return (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange(pageNum)}
            className={linkClass(isActive, false)}
            data-testid={`pagination-page-${pageNum}`}
          >
            {pageNum}
          </button>
        );
      })}

      {/* Next */}
      {next_page && !disabled ? (
        <button
          type="button"
          onClick={() => onPageChange(next_page)}
          className={linkClass(false, false)}
          data-testid="pagination-next"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </button>
      ) : (
        <span className={linkClass(false, true)} data-testid="pagination-next-disabled">
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </span>
      )}
    </div>
  );
}
