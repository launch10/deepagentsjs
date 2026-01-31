import { useState, useRef } from "react";
import { usePage } from "@inertiajs/react";
import FaqSection from "@components/support/FaqSection";
import SupportChat from "@components/support/SupportChat";
import ContactForm from "@components/support/ContactForm";
import { Button } from "@components/ui/button";
import { ArrowDownIcon } from "@heroicons/react/24/outline";
import type { FaqItem } from "~/types/faq";

interface SupportPageProps {
  faqs: FaqItem[];
  thread_id: string | null;
  [key: string]: unknown;
}

export default function Support() {
  const { faqs } = usePage<SupportPageProps>().props;
  const [chatOpen, setChatOpen] = useState(false);
  const contactFormRef = useRef<HTMLDivElement>(null);

  const scrollToContactForm = () => {
    contactFormRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-neutral-background">
      <div className="px-4 py-6 lg:px-12 lg:py-10">
        <h1 className="font-serif text-[28px] font-semibold text-base-500 mb-2">
          Help Center
        </h1>
        <p className="font-sans text-sm text-neutral-600 mb-6">
          Find answers to common questions or chat with our AI assistant.
        </p>

        <div className="w-full lg:w-[720px] space-y-8">
          {/* FAQ Section */}
          {faqs && faqs.length > 0 ? (
            <FaqSection faqs={faqs} />
          ) : (
            <p className="font-sans text-sm text-neutral-500 py-4">
              No FAQs available at this time. Try chatting with our AI assistant or contact support below.
            </p>
          )}

          {/* CTA Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 py-4">
            <p className="font-sans text-sm text-neutral-600">
              Can't find what you're looking for?
            </p>
            <div className="flex gap-2">
              <SupportChat
                isOpen={chatOpen}
                onToggle={() => setChatOpen(!chatOpen)}
              />
              {!chatOpen && (
                <Button variant="outline" onClick={scrollToContactForm}>
                  <ArrowDownIcon className="w-4 h-4" />
                  Contact Support
                </Button>
              )}
            </div>
          </div>

          {/* Contact Form */}
          <div ref={contactFormRef}>
            <h2 className="font-sans text-lg font-semibold text-base-500 mb-3">
              Contact Support
            </h2>
            <ContactForm />
          </div>

          <p className="font-sans text-sm text-neutral-600 mt-4">
            You can also email us directly at{" "}
            <a
              href="mailto:support@launch10.ai"
              className="text-base-500 underline"
            >
              support@launch10.ai
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
