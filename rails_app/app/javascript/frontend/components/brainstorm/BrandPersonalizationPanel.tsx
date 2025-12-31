import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { LogoUploadSection } from "./brand/LogoUploadSection";
import { ColorPaletteSection } from "./brand/ColorPaletteSection";
import { SocialLinksSection } from "./brand/SocialLinksSection";
import { ProjectImagesSection } from "./brand/ProjectImagesSection";

interface BrandPersonalizationPanelProps {
  className?: string;
  /** When true, the panel will auto-expand (e.g., on question 5 or when personalizations exist) */
  shouldAutoOpen?: boolean;
}

/**
 * Collapsible Brand Personalization panel for brainstorm pages.
 * Allows users to optionally customize brand settings.
 * Auto-opens when shouldAutoOpen is true (on question 5 or when personalizations are applied).
 */
export function BrandPersonalizationPanel({ className, shouldAutoOpen = false }: BrandPersonalizationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasAutoOpened = useRef(false);

  // Auto-open the panel when shouldAutoOpen becomes true (only once per session)
  useEffect(() => {
    if (shouldAutoOpen && !hasAutoOpened.current && !isExpanded) {
      setIsExpanded(true);
      hasAutoOpened.current = true;
    }
  }, [shouldAutoOpen, isExpanded]);

  return (
    <div
      className={twMerge(
        "bg-background border border-neutral-300 rounded-2xl px-3 py-4 w-[288px] shadow-[0px_0px_8px_4px_rgba(167,165,161,0.08)]",
        className
      )}
      data-testid="brand-personalization-panel"
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
        data-testid="brand-personalization-toggle"
        aria-expanded={isExpanded}
      >
        <div className="flex items-baseline gap-1">
          <span className="text-sm text-base-400">Brand Personalization</span>
          <span className="text-xs text-base-300 italic">(optional)</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-base-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-base-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-6" data-testid="brand-personalization-content">
          <LogoUploadSection />
          <ColorPaletteSection />
          <SocialLinksSection />
          <ProjectImagesSection />
        </div>
      )}
    </div>
  );
}
