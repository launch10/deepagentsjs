import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import ReactMarkdown from "react-markdown";
import { twMerge } from "tailwind-merge";
import type { FaqItem } from "~/types/faq";

const CATEGORY_LABELS: Record<string, string> = {
  getting_started: "Getting Started",
  credits_billing: "Credits & Billing",
  landing_pages: "Landing Pages",
  google_ads: "Google Ads",
  account: "Account",
};

interface FaqAccordionProps {
  faqs: FaqItem[];
  /** When true, groups FAQs by category with collapsible sections */
  groupByCategory?: boolean;
}

function FaqItemRow({
  faq,
  isOpen,
  onToggle,
}: {
  faq: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentId = `faq-content-${faq.id}`;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
      >
        <span className="font-sans text-sm font-medium text-base-500 pr-4">
          {faq.question}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={twMerge(
            "w-4 h-4 text-neutral-500 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div id={contentId} role="region" className="px-4 pb-4 pt-0">
          <div className="font-sans text-sm text-base-400 prose prose-sm max-w-none">
            <ReactMarkdown>{faq.answer}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FaqAccordion({ faqs, groupByCategory = false }: FaqAccordionProps) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggle = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (faqs.length === 0) {
    return (
      <p className="font-sans text-sm text-neutral-500 py-8 text-center">
        No questions match your search.
      </p>
    );
  }

  // Flat list (used when searching or filtering by single category)
  if (!groupByCategory) {
    return (
      <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white">
        {faqs.map((faq) => (
          <FaqItemRow
            key={faq.id}
            faq={faq}
            isOpen={openId === faq.id}
            onToggle={() => toggle(faq.id)}
          />
        ))}
      </div>
    );
  }

  // Grouped by category with collapsible sections
  const grouped = faqs.reduce<Record<string, FaqItem[]>>((acc, faq) => {
    if (!acc[faq.category]) acc[faq.category] = [];
    acc[faq.category].push(faq);
    return acc;
  }, {});

  const sortedCategories = Object.keys(grouped).sort();

  return (
    <div className="space-y-3">
      {sortedCategories.map((category) => {
        const categoryFaqs = grouped[category];
        const isExpanded = expandedCategories.has(category);
        const label = CATEGORY_LABELS[category] || category;

        return (
          <div key={category} className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              aria-expanded={isExpanded}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-sans text-sm font-semibold text-base-500">
                  {label}
                </span>
                <span className="font-sans text-xs text-neutral-500">
                  ({categoryFaqs.length})
                </span>
              </div>
              <ChevronRightIcon
                aria-hidden="true"
                className={twMerge(
                  "w-4 h-4 text-neutral-500 shrink-0 transition-transform duration-200",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
            {isExpanded && (
              <div className="divide-y divide-neutral-200 border-t border-neutral-200">
                {categoryFaqs.map((faq) => (
                  <FaqItemRow
                    key={faq.id}
                    faq={faq}
                    isOpen={openId === faq.id}
                    onToggle={() => toggle(faq.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
