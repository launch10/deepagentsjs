import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { BrandPersonalizationProvider } from "@context/BrandPersonalizationProvider";
import { LogoUploadSection } from "./brand/LogoUploadSection";
import { ColorPaletteSection } from "./brand/ColorPaletteSection";
import { SocialLinksSection } from "./brand/SocialLinksSection";
import { ProductImagesSection } from "./brand/ProductImagesSection";

interface BrandPersonalizationPanelProps {
  className?: string;
}

/**
 * Collapsible Brand Personalization panel for brainstorm pages.
 * Allows users to optionally customize brand settings.
 */
export function BrandPersonalizationPanel({ className }: BrandPersonalizationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <BrandPersonalizationProvider>
      <div
        className={twMerge(
          "bg-background border border-neutral-300 rounded-2xl px-3 py-4 w-[288px]",
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
            <ProductImagesSection />
          </div>
        )}
      </div>
    </BrandPersonalizationProvider>
  );
}
