import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { useBrainstormChatThreadId } from "@hooks/useBrainstormChat";
import { BrainstormInputProvider } from "./BrainstormInputContext";
import { BrainstormInput } from "./BrainstormInput";
import { ExampleAnswers } from "./ExampleAnswers";

/**
 * Landing page for new brainstorm conversations.
 * Shows the hero text and centered input.
 * When first message creates a thread, navigates to the conversation page.
 */
export function BrainstormLanding() {
  const threadId = useBrainstormChatThreadId();
  const [isNavigating, setIsNavigating] = useState(false);

  // Track if we've already triggered navigation
  const hasNavigatedRef = useRef(false);

  // Navigate to conversation page when threadId becomes available
  useEffect(() => {
    if (threadId && !hasNavigatedRef.current && !isNavigating) {
      hasNavigatedRef.current = true;
      setIsNavigating(true);
      // Use Inertia router for proper page transition
      router.visit(`/projects/${threadId}/brainstorm`, {
        preserveState: false,
        preserveScroll: false,
      });
    }
  }, [threadId, isNavigating]);

  return (
    <BrainstormInputProvider>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-semibold mb-4 text-base-500 tracking-tight font-serif">
              Tell us your next{" "}
              <span className="relative inline-block">
                <em className="italic">big idea</em>
                <img
                  src="/images/wavy-underline.svg"
                  alt=""
                  className="absolute left-0 -bottom-1 w-full"
                  style={{ height: "8px" }}
                />
              </span>
            </h1>
            <p
              className="text-lg text-base-400 opacity-70 mx-auto leading-relaxed font-sans"
              style={{ maxWidth: "616px" }}
            >
              Add as much detail as you want. The more you share, the more tailored your site and
              campaign will be. No design or tech skills needed.
            </p>
          </div>
          <div className="w-full">
            <BrainstormInput />
            <ExampleAnswers />
          </div>
        </div>
      </div>
    </BrainstormInputProvider>
  );
}
