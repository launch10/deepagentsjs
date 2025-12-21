import { useEffect, useRef } from "react";

/**
 * Hook to scroll to a section when returning from editing.
 * This preserves the user's placement on the page when they return after editing.
 *
 * @param returnToSection - The section ID to scroll to, or null/undefined if no scroll is needed
 * @param clearReturnToSection - Callback to clear the returnToSection value after scrolling
 */
export function useScrollToSection(
  returnToSection: string | null | undefined,
  clearReturnToSection?: () => void
) {
  const hasScrolledRef = useRef(false);

  // Scroll to the section when returning from editing
  useEffect(() => {
    if (returnToSection && !hasScrolledRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready, then scroll
      requestAnimationFrame(() => {
        // Double RAF to ensure layout is complete and page is fully rendered
        requestAnimationFrame(() => {
          const element = document.getElementById(returnToSection);
          if (element) {
            // Scroll to the element with smooth behavior
            // The scroll-mt-4 class on ReviewFormSection provides the offset
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            hasScrolledRef.current = true;
            clearReturnToSection?.();
          }
        });
      });
    }
  }, [returnToSection, clearReturnToSection]);

  // Reset scroll flag when returnToSection changes
  useEffect(() => {
    if (returnToSection) {
      hasScrolledRef.current = false;
    }
  }, [returnToSection]);
}
