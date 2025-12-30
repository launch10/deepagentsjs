import { CardContent } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import ColorPaletteRow from "./ColorPaletteRow";
import { useState } from "react";

export type ColorPalette = string[];

export interface ColorPalettesViewProps {
  palettes: ColorPalette[];
  currentPage: number;
  totalPages: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onAddCustom?: () => void;
  onPaletteSelect?: (palette: ColorPalette) => void;
}

const defaultPalettes: ColorPalette[] = [
  ["#43597f", "#9fc2d5", "#e6f9fa", "#e07655", "#2a3240"],
  ["#2f4554", "#4e9991", "#e5c577", "#e9a46b", "#d77558"],
  ["#de5470", "#f8d476", "#62d4a4", "#3f8ab0", "#183b4a"],
];

export function ColorPalettesView({
  palettes,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onAddCustom,
  onPaletteSelect,
}: ColorPalettesViewProps) {
  return (
    <CardContent className="px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-base-400">Colors</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={currentPage <= 1}
            className="p-0.5 text-base-300 hover:text-base-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-3" />
          </button>
          <span className="text-xs text-base-500">
            {currentPage}/{totalPages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="p-0.5 text-base-300 hover:text-base-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <ChevronRight className="size-3" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {palettes.map((palette, index) => (
          <ColorPaletteRow
            key={index}
            colors={palette}
            onClick={() => onPaletteSelect?.(palette)}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddCustom}
          className="text-xs text-base-500 font-normal h-7 px-2 gap-1"
        >
          <Plus className="size-4" />
          Add Custom
        </Button>
      </div>
    </CardContent>
  );
}

export default function ColorPalettes() {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 2;

  // TODO: Wire up to actual state management
  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleAddCustom = () => {
    // TODO: Add custom palette
  };

  const handlePaletteSelect = (palette: ColorPalette) => {
    // TODO: Select palette
    console.log(palette);
  };

  return (
    <ColorPalettesView
      palettes={defaultPalettes}
      currentPage={currentPage}
      totalPages={totalPages}
      onPrevPage={handlePrevPage}
      onNextPage={handleNextPage}
      onAddCustom={handleAddCustom}
      onPaletteSelect={handlePaletteSelect}
    />
  );
}
