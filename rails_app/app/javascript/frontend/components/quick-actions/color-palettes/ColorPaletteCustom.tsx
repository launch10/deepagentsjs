import { useState, useCallback, useEffect } from "react";
import { X, Check, Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

const DEFAULT_COLORS = ["#0F1113", "#0F1113", "#0F1113", "#0F1113", "#0F1113"];

interface CustomColorPickerProps {
  onSave: (colors: string[]) => void;
  onCancel: () => void;
  initialColors?: string[];
}

/**
 * Inline custom color picker that displays within the panel.
 * Shows 5 color inputs with color swatch, hex input, and remove button.
 */
export function CustomColorPicker({
  onSave,
  onCancel,
  initialColors = DEFAULT_COLORS,
}: CustomColorPickerProps) {
  const [colors, setColors] = useState<string[]>(initialColors);
  const [isSaving, setIsSaving] = useState(false);

  // Handle escape key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleColorChange = useCallback((index: number, color: string) => {
    setColors((prev) => {
      const newColors = [...prev];
      newColors[index] = color;
      return newColors;
    });
  }, []);

  const handleRemoveColor = useCallback((index: number) => {
    setColors((prev) => {
      const newColors = [...prev];
      newColors[index] = "#000000";
      return newColors;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(colors);
    } finally {
      setIsSaving(false);
    }
  }, [colors, onSave]);

  const isValidHex = (color: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  };

  const allColorsValid = colors.every(isValidHex);

  return (
    <div className="space-y-2" data-testid="custom-color-picker-inline">
      {/* Header with Done button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-base-500">Custom Colors</h3>
        <button
          type="button"
          onClick={handleSave}
          disabled={!allColorsValid || isSaving}
          className={twMerge(
            "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
            allColorsValid && !isSaving
              ? "text-base-500 hover:bg-neutral-100"
              : "text-base-300 cursor-not-allowed"
          )}
          data-testid="custom-color-done-btn"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {isSaving ? "Saving..." : "Done"}
        </button>
      </div>

      {/* Color inputs */}
      <div className="space-y-2">
        {colors.map((color, index) => (
          <InlineColorInput
            key={index}
            color={color}
            onChange={(newColor) => handleColorChange(index, newColor)}
            onRemove={() => handleRemoveColor(index)}
          />
        ))}
      </div>
    </div>
  );
}

interface InlineColorInputProps {
  color: string;
  onChange: (color: string) => void;
  onRemove: () => void;
}

function InlineColorInput({ color, onChange, onRemove }: InlineColorInputProps) {
  const [hexInput, setHexInput] = useState(color);

  // Sync hex input when color prop changes
  useEffect(() => {
    setHexInput(color);
  }, [color]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Auto-add # if missing
    if (value && !value.startsWith("#")) {
      value = "#" + value;
    }
    setHexInput(value);

    // Only update parent if valid hex
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onChange(value);
    }
  };

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHexInput(value);
    onChange(value);
  };

  const isValid = /^#[0-9A-Fa-f]{6}$/.test(hexInput);

  // Format display value without # prefix
  const displayValue = hexInput.startsWith("#") ? hexInput.slice(1) : hexInput;

  return (
    <div className="flex items-center gap-1 w-full">
      {/* Color swatch with native picker */}
      <div className="relative shrink-0">
        <div
          className="w-10 h-10 rounded"
          style={{ backgroundColor: isValid ? hexInput : "#000000" }}
        />
        <input
          type="color"
          value={isValid ? hexInput : "#000000"}
          onChange={handleColorPickerChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Color picker"
        />
      </div>

      {/* Hex input */}
      <div className="flex-1">
        <div
          className={twMerge(
            "flex items-center bg-white border rounded-lg px-4 py-3",
            isValid ? "border-neutral-300" : "border-red-300"
          )}
        >
          <span className="text-xs text-base-500">#</span>
          <input
            type="text"
            value={displayValue}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setHexInput("#" + val);
              if (/^[0-9A-Fa-f]{6}$/.test(val)) {
                onChange("#" + val);
              }
            }}
            placeholder="000000"
            maxLength={6}
            className="flex-1 text-xs text-base-500 bg-transparent outline-none ml-0.5"
            aria-label="Hex color value"
          />
        </div>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 p-1 text-base-400 hover:text-base-500 transition-colors"
        aria-label="Remove color"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
