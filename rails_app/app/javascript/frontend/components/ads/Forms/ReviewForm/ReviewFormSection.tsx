import { Button } from "@components/ui/button";
import { Pencil } from "lucide-react";

interface ReviewFormSectionProps {
  title: string;
  icon?: React.ReactNode;
  showEditSection?: boolean;
  onEditSection?: () => void;
  children: React.ReactNode;
}

export default function ReviewFormSection({
  title,
  icon,
  showEditSection,
  onEditSection,
  children,
}: ReviewFormSectionProps) {
  return (
    <div className="border border-neutral-300 bg-white p-6 rounded-2xl">
      <div className="py-8 px-9 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold leading-5 flex items-center gap-2">
            {icon && icon}
            <span>{title}</span>
          </h2>
          {showEditSection && (
            <Button variant="ghost" size="sm" onClick={onEditSection}>
              <Pencil size={16} />
              <span>Edit Section</span>
            </Button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
