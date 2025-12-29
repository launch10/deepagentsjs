import { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { twMerge } from "tailwind-merge";

const DEFAULT_COLORS = ["#5867C4", "#3D4A94", "#E48568", "#EDEDEC", "#2E3238"];

interface CustomColorPickerProps {
  onSave: (colors: string[]) => void;
  onCancel: () => void;
  initialColors?: string[];
}

export function CustomColorPicker({
  onSave,
  onCancel,
  initialColors = DEFAULT_COLORS,
}: CustomColorPickerProps) {
  const [colors, setColors] = useState<string[]>(initialColors);
  const [isSaving, setIsSaving] = useState(false);

  // Handle escape key to close
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-color-picker-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[320px] max-w-[90vw] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="custom-color-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <h3
            id="custom-color-picker-title"
            className="text-sm font-semibold text-base-500"
          >
            Create Custom Palette
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-base-400 hover:text-base-500 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Color inputs */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-base-400">
            Select 5 colors for your custom palette
          </p>

          <div className="space-y-2">
            {colors.map((color, index) => (
              <ColorInput
                key={index}
                index={index}
                color={color}
                onChange={(newColor) => handleColorChange(index, newColor)}
              />
            ))}
          </div>

          {/* Preview */}
          <div className="pt-2">
            <p className="text-xs text-base-400 mb-1">Preview</p>
            <div className="flex h-10 rounded overflow-hidden">
              {colors.map((color, index) => (
                <div
                  key={index}
                  className={twMerge(
                    "flex-1 h-full",
                    index === 0 && "rounded-l",
                    index === colors.length - 1 && "rounded-r"
                  )}
                  style={{ backgroundColor: isValidHex(color) ? color : "#EDEDEC" }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-200 bg-neutral-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-base-500 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!allColorsValid || isSaving}
            className={twMerge(
              "px-4 py-2 text-sm text-white rounded-lg transition-colors",
              allColorsValid && !isSaving
                ? "bg-primary-500 hover:bg-primary-600"
                : "bg-neutral-300 cursor-not-allowed"
            )}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ColorInputProps {
  index: number;
  color: string;
  onChange: (color: string) => void;
}

function ColorInput({ index, color, onChange }: ColorInputProps) {
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

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-base-400 w-6">{index + 1}.</span>

      {/* Native color picker */}
      <input
        type="color"
        value={isValid ? hexInput : "#000000"}
        onChange={handleColorPickerChange}
        className="w-8 h-8 rounded cursor-pointer border border-neutral-200"
        aria-label={`Color ${index + 1} picker`}
      />

      {/* Hex input */}
      <input
        type="text"
        value={hexInput}
        onChange={handleHexChange}
        placeholder="#000000"
        maxLength={7}
        className={twMerge(
          "flex-1 px-2 py-1.5 text-xs border rounded",
          "focus:outline-none focus:ring-1 focus:ring-primary-500",
          isValid ? "border-neutral-200" : "border-red-300"
        )}
        aria-label={`Color ${index + 1} hex value`}
      />
    </div>
  );
}
