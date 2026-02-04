import { useState } from "react";
import SupportChat from "@components/support/SupportChat";
import ContactForm from "@components/support/ContactForm";
import { Button } from "@components/ui/button";
import {
  ChatBubbleLeftEllipsisIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

type Tab = "ai" | "human";

export default function Support() {
  const [activeTab, setActiveTab] = useState<Tab>("ai");

  return (
    <main className="min-h-screen bg-neutral-background">
      <div className="px-4 py-6 lg:px-12 lg:py-10">
        <h1 className="font-serif text-[28px] font-semibold text-base-500 mb-2">
          Help Center
        </h1>
        <p className="font-sans text-sm text-neutral-600 mb-6">
          Find quick answers or get help from our team.
        </p>

        <div className="w-full lg:w-[720px]">
          {/* Tab buttons */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={activeTab === "ai" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("ai")}
            >
              <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
              Chat with AI
            </Button>
            <Button
              variant={activeTab === "human" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("human")}
            >
              <EnvelopeIcon className="w-4 h-4" />
              Contact Support
            </Button>
          </div>

          {/* Tab content */}
          {activeTab === "ai" && <SupportChat />}
          {activeTab === "human" && <ContactForm />}
        </div>
      </div>
    </main>
  );
}
