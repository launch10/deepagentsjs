export type PaginationVariant = "workflow" | "review" | "launched";

export interface VariantConfig {
  primaryLabel: string;
  secondaryLabel: string;
  showPreviousStep: boolean;
  showSecondaryButton: boolean;
}

export interface AdCampaignPaginationViewProps {
  className?: string;
  variant?: PaginationVariant;
  onBack?: () => void;
  onPrimary: () => void;
  onSecondary?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  isPending?: boolean;
  showPrimaryAction?: boolean;
  primaryLabel?: string;
  secondaryLabel?: string;
  validationFailed?: boolean;
  onValidationAnimationEnd?: () => void;
}

export const VARIANT_CONFIG: Record<PaginationVariant, VariantConfig> = {
  workflow: {
    primaryLabel: "Return to Launch Review",
    secondaryLabel: "Continue",
    showPreviousStep: true,
    showSecondaryButton: true,
  },
  review: {
    primaryLabel: "Launch Campaign",
    secondaryLabel: "",
    showPreviousStep: true,
    showSecondaryButton: false,
  },
  launched: {
    primaryLabel: "Review Performance",
    secondaryLabel: "View Dashboard",
    showPreviousStep: false,
    showSecondaryButton: true,
  },
};
