import { Lock, LockOpen } from "lucide-react";
import { InputGroup, InputGroupInput } from "@components/ui/input-group";
import { Button } from "@components/ui/button";
import { forwardRef } from "react";

interface InputLockableProps {
  placeholder: string;
  value?: string;
  isLocked?: boolean;
  isInvalid?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLockToggle?: () => void;
  name?: string;
}

const InputLockable = forwardRef<HTMLInputElement, InputLockableProps>(
  (
    { placeholder, value, isLocked = false, isInvalid = false, onChange, onLockToggle, name },
    ref
  ) => {
    return (
      <div className="flex items-center gap-1">
        <Button type="button" onClick={onLockToggle} variant="ghost" size="icon" className="p-0 h-auto w-auto">
          {isLocked ? (
            <Lock size={12} className="text-base" />
          ) : (
            <LockOpen size={12} className="text-[#96989B]" />
          )}
        </Button>
        <InputGroup className={`h-10 ${isLocked ? "border-[#2E3238]" : ""}`}>
          <InputGroupInput
            ref={ref}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={isLocked}
            className="disabled:opacity-100"
            aria-invalid={isInvalid}
          />
        </InputGroup>
      </div>
    );
  }
);

InputLockable.displayName = "InputLockable";

export default InputLockable;
