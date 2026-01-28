import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { X } from "lucide-react";

interface CreditPack {
  id: number;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id?: string | null;
}

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchase?: (packId: number) => void;
  creditPacks?: CreditPack[];
}

// Tag configuration based on pack name
const PACK_TAGS: Record<string, { label: string; color: "green" | "yellow" }> = {
  medium: { label: "Most Popular", color: "green" },
  big: { label: "Best Value", color: "yellow" },
};

export function BuyCreditsModal({
  open,
  onOpenChange,
  onPurchase,
  creditPacks = [],
}: BuyCreditsModalProps) {
  // Default to the middle pack (Medium) if available
  const defaultPackId = creditPacks.length > 1 ? creditPacks[1].id : creditPacks[0]?.id;
  const [selectedPackId, setSelectedPackId] = useState<number | undefined>(defaultPackId);

  // Update selected pack when creditPacks changes
  useEffect(() => {
    if (creditPacks.length > 0 && !selectedPackId) {
      const mediumPack = creditPacks.find((p) => p.name === "medium");
      setSelectedPackId(mediumPack?.id ?? creditPacks[0].id);
    }
  }, [creditPacks, selectedPackId]);

  const handlePurchase = () => {
    if (onPurchase && selectedPackId) {
      onPurchase(selectedPackId);
    }
    // TODO: Integrate with Stripe checkout
    onOpenChange(false);
  };

  if (creditPacks.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="sm:max-w-[600px] p-0 gap-0 bg-white border border-[#E2E1E0] rounded-lg shadow-[0px_4px_4px_-1px_rgba(12,12,13,0.1),0px_4px_4px_-1px_rgba(12,12,13,0.05)]"
      >
        <DialogClose className="absolute right-4 top-4 rounded-sm transition-opacity hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="h-4 w-4 text-[#74767A]" />
          <span className="sr-only">Close</span>
        </DialogClose>
        <DialogHeader className="px-12 pt-6 pb-0">
          <div className="flex items-center gap-2">
            <DialogTitle className="font-['Plus_Jakarta_Sans'] text-lg font-semibold text-[#0F1113]">
              Buy More Credits
            </DialogTitle>
            <SparklesIcon className="h-4 w-4 text-[#0F1113]" />
          </div>
          <DialogDescription className="font-['Plus_Jakarta_Sans'] text-sm text-[#74767A] pt-1">
            Select a credit pack to continue using AI features.
          </DialogDescription>
        </DialogHeader>

        <div className="px-12 pt-4 pb-6 space-y-3">
          {creditPacks.map((pack) => (
            <CreditPackOption
              key={pack.id}
              pack={pack}
              selected={selectedPackId === pack.id}
              onSelect={() => setSelectedPackId(pack.id)}
              tag={PACK_TAGS[pack.name]}
            />
          ))}
        </div>

        <div className="flex justify-end px-12 pb-6">
          <Button
            onClick={handlePurchase}
            className="h-11 min-w-[183px] bg-[#2E3238] hover:bg-[#1a1e22] text-white font-['Plus_Jakarta_Sans'] text-base font-normal rounded-lg"
          >
            Continue to Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CreditPackOptionProps {
  pack: CreditPack;
  selected: boolean;
  onSelect: () => void;
  tag?: { label: string; color: "green" | "yellow" };
}

// Map database names to display names
const PACK_DISPLAY_NAMES: Record<string, string> = {
  small: "Small",
  medium: "Medium",
  big: "Large",
};

function CreditPackOption({ pack, selected, onSelect, tag }: CreditPackOptionProps) {
  const priceDollars = pack.price_cents / 100;
  const displayName = PACK_DISPLAY_NAMES[pack.name] || pack.name;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full h-[67px] px-4 rounded-lg border transition-colors text-left flex items-center justify-between ${
        selected ? "border-[#0F1113] bg-white" : "border-[#E2E1E0] bg-white hover:border-[#A7A5A1]"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Radio button */}
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            selected ? "border-[#0F1113]" : "border-[#A7A5A1]"
          }`}
        >
          {selected && <div className="w-2.5 h-2.5 rounded-full bg-[#0F1113]" />}
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#0F1113] leading-tight">
            {displayName}
          </span>
          <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#6F6E6B] leading-tight">
            {pack.credits.toLocaleString()} credits
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {tag && (
          <span
            className={`px-3 py-1 rounded-full font-['Plus_Jakarta_Sans'] text-xs font-medium ${
              tag.color === "green" ? "bg-[#D9F4E9] text-[#1F694C]" : "bg-[#FAECDB] text-[#BF873F]"
            }`}
          >
            {tag.label}
          </span>
        )}
        <span className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#0F1113]">
          ${priceDollars}
        </span>
      </div>
    </button>
  );
}
