import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import ReactMarkdown from "react-markdown";
import { twMerge } from "tailwind-merge";
import type { FaqItem } from "~/types/faq";

interface FaqAccordionProps {
  faqs: FaqItem[];
}

export default function FaqAccordion({ faqs }: FaqAccordionProps) {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  if (faqs.length === 0) {
    return (
      <p className="font-sans text-sm text-neutral-500 py-8 text-center">
        No questions match your search.
      </p>
    );
  }

  return (
    <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white">
      {faqs.map((faq) => {
        const isOpen = openId === faq.id;
        const contentId = `faq-content-${faq.id}`;

        return (
          <div key={faq.id}>
            <button
              type="button"
              onClick={() => toggle(faq.id)}
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
                <div className="font-sans text-sm text-neutral-600 prose prose-sm max-w-none">
                  <ReactMarkdown>{faq.answer}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
