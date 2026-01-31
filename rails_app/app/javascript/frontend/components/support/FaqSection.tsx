import { useState, useMemo } from "react";
import FaqSearch from "./FaqSearch";
import FaqCategoryFilter from "./FaqCategoryFilter";
import FaqAccordion from "./FaqAccordion";
import { useDebounce } from "@hooks/useDebounce";
import type { FaqItem } from "~/types/faq";

interface FaqSectionProps {
  faqs: FaqItem[];
}

export default function FaqSection({ faqs }: FaqSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Get unique categories that have FAQs
  const categories = useMemo(() => {
    const cats = new Set(faqs.map((f) => f.category));
    return Array.from(cats).sort();
  }, [faqs]);

  // Filter FAQs by search + category
  const filteredFaqs = useMemo(() => {
    let results = faqs;

    if (selectedCategory !== "all") {
      results = results.filter((f) => f.category === selectedCategory);
    }

    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase();
      results = results.filter(
        (f) =>
          f.question.toLowerCase().includes(query) ||
          f.answer.toLowerCase().includes(query)
      );
    }

    return results;
  }, [faqs, selectedCategory, debouncedQuery]);

  return (
    <div className="space-y-4">
      <FaqSearch value={searchQuery} onChange={setSearchQuery} />
      <FaqCategoryFilter
        categories={categories}
        selected={selectedCategory}
        onChange={setSelectedCategory}
      />
      <FaqAccordion faqs={filteredFaqs} />
    </div>
  );
}
