import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Input } from "@components/ui/input";

interface FaqSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FaqSearch({ value, onChange }: FaqSearchProps) {
  return (
    <div className="relative">
      <MagnifyingGlassIcon
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search FAQs..."
        className="pl-9 text-base-500"
      />
    </div>
  );
}
