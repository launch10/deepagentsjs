import { Plus } from "lucide-react";
import { cn } from "@lib/utils";

interface InputAddableProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  isInvalid: boolean;
  handleAdd: () => void;
  placeholder?: string;
  className?: string;
}

export default function InputAddable({
  value,
  onChange,
  onKeyDown,
  isInvalid,
  handleAdd,
  placeholder = "",
  className,
}: InputAddableProps) {
  return (
    <div className="flex border border-neutral-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring">
      <input
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        aria-invalid={isInvalid}
        className={cn(
          "flex-1 h-10 px-4 text-xs placeholder:text-neutral-400 outline-none bg-transparent border-none shadow-none",
          // TODO: Add error styles
          className
        )}
      />
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-2 h-10 px-3 bg-background border-l border-neutral-300 text-sm text-base-500 hover:bg-neutral-100"
      >
        <Plus size={16} /> Add
      </button>
    </div>
  );
}
