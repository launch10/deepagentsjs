import { memo, useState, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { LogoUploadSection } from "./LogoUploadSection";
import { ColorPaletteSection } from "./ColorPaletteSection";
import { SocialLinksSection } from "./SocialLinksSection";
import { ProjectImagesSection } from "./ProjectImagesSection";

interface BrandPersonalizationPanelProps {
  className?: string;
}

/**
 * Collapsible Brand Personalization panel for brainstorm pages.
 * Starts expanded by default. Wrapped in React.memo — only prop is
 * a static className, so it never re-renders from parent cascade.
 */
export const BrandPersonalizationPanel = memo(function BrandPersonalizationPanel({ className }: BrandPersonalizationPanelProps) {
  const renderCount = useRef(0);
  renderCount.current += 1;
  if (process.env.NODE_ENV === "development") {
    console.log(`[BrandPanel] render #${renderCount.current}`);
  }

  const [isExpanded, setIsExpanded] = useState(true);

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
});
