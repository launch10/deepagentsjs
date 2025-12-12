import { Button } from "@components/ui/button";
import { twMerge } from "tailwind-merge";
import {
  useFormRegistry,
  selectFocusedParent,
  selectValidateParent,
  selectValidateAll,
} from "@stores/formRegistry";
import { useAdsChatState } from "@hooks/useAdsChat";

interface FooterProps {
  className?: string;
  onBack?: () => void;
  onContinue?: (data: { headlines: any[]; descriptions: any[] }) => void;
}

export default function Footer({ className, onBack, onContinue }: FooterProps) {
  const focusedParent = useFormRegistry(selectFocusedParent);
  const validateParent = useFormRegistry(selectValidateParent);
  const validateAll = useFormRegistry(selectValidateAll);
  const headlines = useAdsChatState("headlines");
  const descriptions = useAdsChatState("descriptions");

  const handleContinue = async () => {
    let isValid = false;

    if (focusedParent) {
      isValid = await validateParent(focusedParent);
    } else {
      isValid = await validateAll();
    }

    if (!isValid) return;

    onContinue?.({
      headlines: headlines || [],
      descriptions: descriptions || [],
    });
  };

  return (
    <div
      className={twMerge(
        "sticky bottom-0 mt-3",
        "bg-background flex justify-between items-center border-t border-neutral-200 py-4 px-6 shadow-[9px_-16px_26.1px_1px_#74767A12]",
        className
      )}
    >
      <Button variant="link" onClick={onBack}>
        Previous Step
      </Button>
      <Button onClick={handleContinue}>Continue</Button>
    </div>
  );
}
