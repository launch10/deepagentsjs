import { Button } from "@components/ui/button";

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  getting_started: "Getting Started",
  credits_billing: "Credits & Billing",
  landing_pages: "Landing Pages",
  google_ads: "Google Ads",
  account: "Account",
};

interface FaqCategoryFilterProps {
  categories: string[];
  selected: string;
  onChange: (category: string) => void;
}

export default function FaqCategoryFilter({
  categories,
  selected,
  onChange,
}: FaqCategoryFilterProps) {
  const allCategories = ["all", ...categories];

  return (
    <div className="flex flex-wrap gap-2">
      {allCategories.map((cat) => (
        <Button
          key={cat}
          variant={selected === cat ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(cat)}
          className="text-xs"
        >
          {CATEGORY_LABELS[cat] || cat}
        </Button>
      ))}
    </div>
  );
}
