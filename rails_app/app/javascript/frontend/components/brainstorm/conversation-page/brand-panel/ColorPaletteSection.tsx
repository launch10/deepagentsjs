import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useQueryClient } from "@tanstack/react-query";
import { useThemes, useCreateTheme, themeKeys } from "@api/themes.hooks";
import { useWebsite, useUpdateWebsiteTheme, websiteKeys } from "@api/websites.hooks";
import { CustomColorPicker } from "./CustomColorPicker";
import type { GetThemesResponse } from "@rails_api_base";
import { subscribeToAgentIntent } from "@hooks/useAgentIntent";

type Theme = GetThemesResponse[number];

const PALETTES_PER_PAGE = 3;

interface ColorPaletteSectionProps {
  className?: string;
  /**
   * Optional handler for theme selection.
   * If provided, this is called instead of the internal mutation.
   * Used on Website page to trigger intent-based graph flow.
   */
  onThemeSelect?: (themeId: number | null) => void;
}

export function ColorPaletteSection({ className, onThemeSelect }: ColorPaletteSectionProps) {
  // Read directly from queries - no store
  const { data: themes = [], isLoading: isLoadingThemes } = useThemes();
  const { data: website, isLoading: isLoadingWebsite } = useWebsite();
  const createThemeMutation = useCreateTheme();
  const updateThemeMutation = useUpdateWebsiteTheme();
  const sectionRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef(false);
  // Track the theme ID that was selected BEFORE the agent intent fired,
  // so we know to wait for a DIFFERENT selectedThemeId before scrolling.
  const preIntentThemeIdRef = useRef<number | null>(null);

  // Selected theme comes directly from website query
  const selectedThemeId = website?.theme_id ?? null;
  // Keep a ref for use in subscribeToAgentIntent callback (avoids stale closure)
  const selectedThemeIdRef = useRef(selectedThemeId);
  selectedThemeIdRef.current = selectedThemeId;

  // Refetch when the agent applies a color scheme via chat
  const queryClient = useQueryClient();
  subscribeToAgentIntent("color_scheme_applied", () => {
    preIntentThemeIdRef.current = selectedThemeIdRef.current;
    pendingScrollRef.current = true;
    queryClient.invalidateQueries({ queryKey: themeKeys.all });
    queryClient.invalidateQueries({ queryKey: websiteKeys.all });
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Auto-scroll to selected theme's page on initial load
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (!hasScrolledRef.current && selectedThemeId && themes.length > 0) {
      const themeIndex = themes.findIndex((t) => t.id === selectedThemeId);
      if (themeIndex !== -1) {
        setCurrentPage(Math.floor(themeIndex / PALETTES_PER_PAGE));
        hasScrolledRef.current = true;
      }
    }
  }, [selectedThemeId, themes]);

  // Navigate to the page containing the agent-applied theme.
  // Waits for BOTH queries to settle: selectedThemeId must differ from what
  // it was pre-intent, AND the new theme must exist in the themes list.
  useEffect(() => {
    if (!pendingScrollRef.current || themes.length === 0) return;
    // Wait for website query to resolve with the NEW theme
    if (selectedThemeId === preIntentThemeIdRef.current) return;
    if (selectedThemeId === null) return;
    const themeIndex = themes.findIndex((t) => t.id === selectedThemeId);
    if (themeIndex === -1) return; // theme not in list yet, wait for next render
    setCurrentPage(Math.floor(themeIndex / PALETTES_PER_PAGE));
    pendingScrollRef.current = false;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedThemeId, themes]);

  const isLoading = isLoadingThemes || isLoadingWebsite;

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

      if (onThemeSelect) {
        // Use external handler (intent-based flow on Website page)
        onThemeSelect(newThemeId);
      } else {
        // Fallback to direct mutation (Brainstorm page)
        updateThemeMutation.mutate({ themeId: newThemeId });
      }
    },
    [selectedThemeId, onThemeSelect, updateThemeMutation]
  );

  const handleCreateCustomPalette = useCallback(
    async (colors: string[]) => {
      const newTheme = await createThemeMutation.mutateAsync({
        name: "Custom Palette",
        colors,
      });

      // Use intent flow (Website page) or direct mutation (Brainstorm page)
      if (onThemeSelect) {
        onThemeSelect(newTheme.id);
      } else {
        updateThemeMutation.mutate({ themeId: newTheme.id });
      }

      setShowCustomPicker(false);
      // Navigate to the first page to show the new palette (it's prepended)
      setCurrentPage(0);
    },
    [createThemeMutation, updateThemeMutation, onThemeSelect]
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
    <div ref={sectionRef} className={twMerge("space-y-2", className)}>
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
      data-testid={`color-palette-${theme.id}`}
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
