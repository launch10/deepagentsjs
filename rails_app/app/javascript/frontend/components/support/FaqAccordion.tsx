import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import ReactMarkdown from "react-markdown";
import { twMerge } from "tailwind-merge";

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  subcategory: string | null;
  slug: string;
}

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
      <p className="font-['Plus_Jakarta_Sans'] text-sm text-[#9CA3AF] py-8 text-center">
        No questions match your search.
      </p>
    );
  }

  return (
    <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-lg bg-white">
      {faqs.map((faq) => (
        <div key={faq.id}>
          <button
            type="button"
            onClick={() => toggle(faq.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#F9FAFB] transition-colors"
          >
            <span className="font-['Plus_Jakarta_Sans'] text-sm font-medium text-[#2E3238] pr-4">
              {faq.question}
            </span>
            <ChevronDownIcon
              className={twMerge(
                "w-4 h-4 text-[#9CA3AF] shrink-0 transition-transform duration-200",
                openId === faq.id && "rotate-180"
              )}
            />
          </button>
          {openId === faq.id && (
            <div className="px-4 pb-4 pt-0">
              <div className="font-['Plus_Jakarta_Sans'] text-sm text-[#6B7280] prose prose-sm max-w-none">
                <ReactMarkdown>{faq.answer}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
