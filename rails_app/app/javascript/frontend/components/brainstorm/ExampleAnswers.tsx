import { useState } from "react";

type ExpandedSection = "examples" | "howItWorks" | null;

/**
 * Expandable component showing example answers and how it works.
 * Only shown on BrainstormLanding page.
 * Only one section can be expanded at a time.
 */
export function ExampleAnswers() {
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

  const toggleSection = (section: ExpandedSection) => {
    setExpandedSection((current) => (current === section ? null : section));
  };

  const isExamplesExpanded = expandedSection === "examples";
  const isHowItWorksExpanded = expandedSection === "howItWorks";

  return (
    <div className="mt-4 font-sans">
      {/* Links */}
      <div className="flex items-center justify-center gap-2 text-sm text-base-400">
        <button
          onClick={() => toggleSection("examples")}
          className={`hover:opacity-70 transition-opacity ${
            isExamplesExpanded ? "text-base-500 underline" : "text-base-400"
          }`}
        >
          See examples of answers
        </button>
        <span className="opacity-70">•</span>
        <button
          onClick={() => toggleSection("howItWorks")}
          className={`hover:opacity-70 transition-opacity ${
            isHowItWorksExpanded ? "text-base-500 underline" : "text-base-400"
          }`}
        >
          Learn how it works
        </button>
      </div>

      {/* Examples expandable content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          isExamplesExpanded ? "max-h-[400px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className="border border-neutral-200 rounded-2xl px-6 py-6 mx-auto"
          style={{ maxWidth: "703px" }}
        >
          <div className="text-xs text-base-500 leading-relaxed">
            <p className="mb-0">
              <span className="font-semibold">Example structure:</span>
            </p>
            <p className="mb-4">
              [Business Name] is a [type of business] that [does what] for [target customer].
            </p>

            <p className="font-semibold mb-1">Examples:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>
                DevMode is a software tool that lets users view the code behind any interface.
              </li>
              <li>
                Friend of the Pod is a podcast matchmaking service connecting podcast producers with
                relevant guests.
              </li>
              <li>
                QuotaHit is a sales enablement platform built for content management and sales
                coaching.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* How it works expandable content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          isHowItWorksExpanded ? "max-h-[400px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className="border border-neutral-200 rounded-2xl px-6 py-6 mx-auto"
          style={{ maxWidth: "703px" }}
        >
          <ol className="text-xs text-base-500 leading-relaxed list-decimal ml-4 space-y-1">
            <li>You tell us your big idea and we'll build your website together.</li>
            <li>
              Next we'll design a high-performing Google Ads campaign to get people clicking on your
              site.
            </li>
            <li>
              Then you can see what's working and what's not. We'll make recommendations to improve
              your outcomes.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
