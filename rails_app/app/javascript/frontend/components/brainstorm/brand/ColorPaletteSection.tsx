import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { twMerge } from "tailwind-merge";
import {
  useBrandPersonalizationStore,
  selectSelectedThemeId,
} from "@context/BrandPersonalizationProvider";
import { useThemes, useCreateTheme } from "@api/themes.hooks";
import { useUpdateWebsiteTheme } from "@api/websites.hooks";
import { CustomColorPicker } from "./CustomColorPicker";
import type { GetThemesResponse } from "@api/themes";

type Theme = GetThemesResponse[number];

const PALETTES_PER_PAGE = 3;

interface ColorPaletteSectionProps {
  className?: string;
}

export function ColorPaletteSection({ className }: ColorPaletteSectionProps) {
  const selectedThemeId = useBrandPersonalizationStore(selectSelectedThemeId);
  const setTheme = useBrandPersonalizationStore((s) => s.setTheme);

  // TanStack Query hooks for caching
  const { data: themes = [], isLoading } = useThemes();
  const createThemeMutation = useCreateTheme();
  const updateWebsiteThemeMutation = useUpdateWebsiteTheme();

  const [currentPage, setCurrentPage] = useState(0);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const totalPages = Math.max(1, Math.ceil(themes.length / PALETTES_PER_PAGE));
  const visibleThemes = themes.slice(
    currentPage * PALETTES_PER_PAGE,
    (currentPage + 1) * PALETTES_PER_PAGE
  );

  const handlePrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  }, [totalPages]);

  const handleSelectTheme = useCallback(
    (themeId: number) => {
      const newThemeId = selectedThemeId === themeId ? null : themeId;
      setTheme(newThemeId);
      // Persist to backend
      updateWebsiteThemeMutation.mutate({ themeId: newThemeId });
    },
    [setTheme, selectedThemeId, updateWebsiteThemeMutation]
  );

  const handleCreateCustomPalette = useCallback(
    async (colors: string[]) => {
      const newTheme = await createThemeMutation.mutateAsync({
        name: "Custom Palette",
        colors,
      });
      // Select the new theme and close the picker
      setTheme(newTheme.id);
      // Persist to backend
      updateWebsiteThemeMutation.mutate({ themeId: newTheme.id });
      setShowCustomPicker(false);
      // Navigate to the first page to show the new palette (it's prepended)
      setCurrentPage(0);
    },
    [createThemeMutation, setTheme, updateWebsiteThemeMutation]
  );

  if (isLoading) {
    return (
      <div className={twMerge("space-y-2", className)}>
        <h3 className="text-sm font-semibold text-base-500">Colors</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-8 bg-neutral-100 rounded animate-pulse"
              data-slot="skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  // When in custom picker mode, show the inline custom color picker
  if (showCustomPicker) {
    return (
      <div className={twMerge("space-y-2", className)}>
        <CustomColorPicker
          onSave={handleCreateCustomPalette}
          onCancel={() => setShowCustomPicker(false)}
        />
      </div>
    );
  }

  return (
    <div className={twMerge("space-y-2", className)}>
      {/* Header with pagination */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-base-500">Colors</h3>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            className="p-0.5 text-base-300 hover:text-base-500 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous page"
            data-testid="color-pagination-prev"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <span
            className="text-xs text-base-500 min-w-[32px] text-center"
            data-testid="color-pagination-label"
          >
            {currentPage + 1}/{totalPages}
          </span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
            className="p-0.5 text-base-300 hover:text-base-500 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next page"
            data-testid="color-pagination-next"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Color palettes */}
      <div className="space-y-2">
        {visibleThemes.map((theme) => (
          <ColorPaletteRow
            key={theme.id}
            theme={theme}
            isSelected={selectedThemeId === theme.id}
            onSelect={() => handleSelectTheme(theme.id)}
          />
        ))}

        {visibleThemes.length === 0 && (
          <p className="text-xs text-base-300 text-center py-4">No palettes available</p>
        )}
      </div>

      {/* Add Custom button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCustomPicker(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-base-500 hover:bg-neutral-100 rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Custom
        </button>
      </div>
    </div>
  );
}

interface ColorPaletteRowProps {
  theme: Theme;
  isSelected: boolean;
  onSelect: () => void;
}

function ColorPaletteRow({ theme, isSelected, onSelect }: ColorPaletteRowProps) {
  const colors = theme.colors || [];

  // Ensure colors have # prefix for CSS
  const normalizeColor = (color: string) => {
    return color.startsWith("#") ? color : `#${color}`;
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={twMerge(
        "flex w-full h-8 rounded overflow-hidden transition-all",
        "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
        isSelected && "ring-2 ring-primary-500 ring-offset-1"
      )}
      data-testid="color-palette"
      data-selected={isSelected}
      aria-pressed={isSelected}
      aria-label={`Color palette: ${theme.name}`}
    >
      {colors.slice(0, 5).map((color, index) => (
        <div
          key={index}
          className={twMerge(
            "flex-1 h-full",
            index === 0 && "rounded-l",
            index === colors.length - 1 && "rounded-r"
          )}
          style={{ backgroundColor: normalizeColor(color) }}
          aria-hidden="true"
        />
      ))}
    </button>
  );
}
