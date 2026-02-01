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
  /** When true, groups FAQs by subcategory with collapsible sections */
  groupBySubcategory?: boolean;
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

function SubcategorySection({
  subcategory,
  faqs,
  openId,
  toggle,
  isExpanded,
  onToggle,
}: {
  subcategory: string;
  faqs: FaqItem[];
  openId: number | null;
  toggle: (id: number) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between px-5 py-2.5 text-left bg-neutral-50 hover:bg-neutral-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-sans text-sm font-medium text-base-500">
            {subcategory}
          </span>
          <span className="font-sans text-xs text-neutral-500">
            ({faqs.length})
          </span>
        </div>
        <ChevronRightIcon
          aria-hidden="true"
          className={twMerge(
            "w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200",
            isExpanded && "rotate-90"
          )}
        />
      </button>
      {isExpanded && (
        <div className="divide-y divide-neutral-200">
          {faqs.map((faq) => (
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
}

function GroupedSections({
  grouped,
  sortedKeys,
  labelMap,
  openId,
  toggle,
  expandedGroups,
  toggleGroup,
  nestSubcategories,
}: {
  grouped: Record<string, FaqItem[]>;
  sortedKeys: string[];
  labelMap: Record<string, string>;
  openId: number | null;
  toggle: (id: number) => void;
  expandedGroups: Set<string>;
  toggleGroup: (key: string) => void;
  nestSubcategories?: boolean;
}) {
  return (
    <div className="space-y-3">
      {sortedKeys.map((key) => {
        const groupFaqs = grouped[key];
        const isExpanded = expandedGroups.has(key);
        const label = labelMap[key] || key;

        // Check if FAQs in this group have subcategories
        const hasSubcategories =
          nestSubcategories && groupFaqs.some((f) => f.subcategory);

        return (
          <div key={key} className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(key)}
              aria-expanded={isExpanded}
              className="w-full flex items-center justify-between px-4 py-3 text-left bg-neutral-100 hover:bg-neutral-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-sans text-sm font-semibold text-base-500">
                  {label}
                </span>
                <span className="font-sans text-xs text-neutral-500">
                  ({groupFaqs.length})
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
              <ExpandedContent
                faqs={groupFaqs}
                hasSubcategories={hasSubcategories}
                groupKey={key}
                openId={openId}
                toggle={toggle}
                expandedGroups={expandedGroups}
                toggleGroup={toggleGroup}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExpandedContent({
  faqs,
  hasSubcategories,
  groupKey,
  openId,
  toggle,
  expandedGroups,
  toggleGroup,
}: {
  faqs: FaqItem[];
  hasSubcategories?: boolean;
  groupKey: string;
  openId: number | null;
  toggle: (id: number) => void;
  expandedGroups: Set<string>;
  toggleGroup: (key: string) => void;
}) {
  if (!hasSubcategories) {
    return (
      <div className="divide-y divide-neutral-200 border-t border-neutral-200">
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

  // Group by subcategory
  const subcategoryGroups = faqs.reduce<Record<string, FaqItem[]>>(
    (acc, faq) => {
      const sub = faq.subcategory || "General";
      if (!acc[sub]) acc[sub] = [];
      acc[sub].push(faq);
      return acc;
    },
    {}
  );

  const sortedSubs = Object.keys(subcategoryGroups).sort();

  return (
    <div className="divide-y divide-neutral-200 border-t border-neutral-200">
      {sortedSubs.map((sub) => {
        const subKey = `${groupKey}:${sub}`;
        return (
          <SubcategorySection
            key={sub}
            subcategory={sub}
            faqs={subcategoryGroups[sub]}
            openId={openId}
            toggle={toggle}
            isExpanded={expandedGroups.has(subKey)}
            onToggle={() => toggleGroup(subKey)}
          />
        );
      })}
    </div>
  );
}

export default function FaqAccordion({
  faqs,
  groupByCategory = false,
  groupBySubcategory = false,
}: FaqAccordionProps) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggle = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
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

  // Grouped by subcategory
  if (groupBySubcategory) {
    const grouped = faqs.reduce<Record<string, FaqItem[]>>((acc, faq) => {
      const key = faq.subcategory || "General";
      if (!acc[key]) acc[key] = [];
      acc[key].push(faq);
      return acc;
    }, {});

    const sortedKeys = Object.keys(grouped).sort();

    return (
      <GroupedSections
        grouped={grouped}
        sortedKeys={sortedKeys}
        labelMap={{}}
        openId={openId}
        toggle={toggle}
        expandedGroups={expandedGroups}
        toggleGroup={toggleGroup}
      />
    );
  }

  // Grouped by category
  if (groupByCategory) {
    const grouped = faqs.reduce<Record<string, FaqItem[]>>((acc, faq) => {
      if (!acc[faq.category]) acc[faq.category] = [];
      acc[faq.category].push(faq);
      return acc;
    }, {});

    const sortedKeys = Object.keys(grouped).sort();

    return (
      <GroupedSections
        grouped={grouped}
        sortedKeys={sortedKeys}
        labelMap={CATEGORY_LABELS}
        openId={openId}
        toggle={toggle}
        expandedGroups={expandedGroups}
        toggleGroup={toggleGroup}
        nestSubcategories
      />
    );
  }

  // Flat list (used when searching)
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
