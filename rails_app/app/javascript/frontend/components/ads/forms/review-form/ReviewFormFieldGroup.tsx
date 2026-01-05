import { Field, FieldGroup } from "@components/ui/field";
import { Input } from "@components/ui/input";
import { ChevronLeft, ChevronRight, Info, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@components/ui/button";

const ITEMS_PER_PAGE = 3;

interface ReviewFormSectionProps {
  title: string;
  items: { id: string; text: string }[];
  onEditSection?: () => void;
  showPagination?: boolean;
}

export default function ReviewFormFieldGroup({
  title,
  items,
  onEditSection,
  showPagination = true,
}: ReviewFormSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const displayedItems = items.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <FieldGroup className="gap-3">
      <Field>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{title}</span>
            <Info size={12} className="text-base-300" />
          </div>
          {onEditSection && (
            <Button variant="ghost" size="sm" onClick={onEditSection} data-testid="edit-field-group-button">
              <Pencil size={20} />
              <span>Edit Section</span>
            </Button>
          )}
        </div>
      </Field>
      <div className="flex flex-col gap-2">
        {displayedItems.map((item) => (
          <Input
            key={item.id}
            value={item.text}
            readOnly
            className="bg-white border-neutral-300 text-xs cursor-default"
          />
        ))}
      </div>
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 text-xs">
          <span className="text-base-300">
            Showing {startIndex + 1}-{endIndex} of {totalItems}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={handlePrevPage} disabled={currentPage === 1}>
              <ChevronLeft size={12} />
            </button>
            <span className="text-base-600">
              {currentPage}/{totalPages}
            </span>
            <button type="button" onClick={handleNextPage} disabled={currentPage === totalPages}>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </FieldGroup>
  );
}
