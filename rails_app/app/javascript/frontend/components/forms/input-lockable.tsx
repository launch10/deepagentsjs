import { Button } from "@components/ui/button";
import { InputGroup, InputGroupInput } from "@components/ui/input-group";
import { Lock, LockOpen, Trash2 } from "lucide-react";
import { forwardRef } from "react";

interface InputLockableProps {
  placeholder: string;
  value?: string;
  isLocked?: boolean;
  isInvalid?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onLockToggle?: () => void;
  onDelete?: () => void;
  name?: string;
}

const InputLockable = forwardRef<HTMLInputElement, InputLockableProps>(
  (
    {
      placeholder,
      value,
      isLocked = false,
      isInvalid = false,
      onChange,
      onBlur,
      onLockToggle,
      onDelete,
      name,
    },
    ref
  ) => {
    return (
      <div className="flex items-center gap-1">
        {onLockToggle ? (
          <Button
            type="button"
            onClick={onLockToggle}
            variant="ghost"
            size="icon"
            data-testid="lock-toggle-button"
            data-locked={isLocked}
          >
            {isLocked ? (
              <Lock size={12} className="text-base" />
            ) : (
              <LockOpen size={12} className="text-[#96989B]" />
            )}
          </Button>
        ) : null}
        {onDelete ? (
          <Button type="button" onClick={onDelete} variant="ghost" size="icon" data-testid="delete-button">
            <Trash2 size={14} className="text-[#96989B]" />
          </Button>
        ) : null}
        <InputGroup className={`h-10 ${isLocked ? "border-[#2E3238]" : ""}`} data-testid="lockable-input-group">
          <InputGroupInput
            ref={ref}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={isLocked}
            className="disabled:opacity-100"
            aria-invalid={isInvalid}
            data-testid="lockable-input"
          />
        </InputGroup>
      </div>
    );
  }
);

InputLockable.displayName = "InputLockable";

export default InputLockable;
