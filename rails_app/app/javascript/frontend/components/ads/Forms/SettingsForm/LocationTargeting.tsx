import { useState, useMemo, useEffect } from "react";
import { Search, Info, X } from "lucide-react";
import { cn } from "@lib/utils";
import { useQuery } from "@tanstack/react-query";
import { usePage } from "@inertiajs/react";
import {
  GeoTargetConstantsService,
  type SearchGeoTargetConstantsResponse,
} from "@api/geoTargetConstants";
import type { CampaignProps } from "@components/ads/Sidebar/WorkflowBuddy/ad-campaign.types";

type GeoTarget = SearchGeoTargetConstantsResponse[number];

interface LocationTargetingProps {
  selectedLocations?: GeoTarget[];
  onLocationsChange?: (locations: GeoTarget[]) => void;
}

export default function LocationTargeting({
  selectedLocations = [],
  onLocationsChange,
}: LocationTargetingProps) {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);
  const { jwt } = usePage<CampaignProps>().props;

  const service = useMemo(() => new GeoTargetConstantsService({ jwt }), [jwt]);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["geoTargetConstants", debouncedSearchValue],
    queryFn: () => service.search({ location_query: debouncedSearchValue }),
    enabled: debouncedSearchValue.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const filteredSuggestions = suggestions.filter(
    (s) => !selectedLocations.some((loc) => loc.criteria_id === s.criteria_id)
  );

  const hasError = selectedLocations.length === 0;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setIsDropdownOpen(true);
  };

  const handleSelectLocation = (location: GeoTarget) => {
    onLocationsChange?.([...selectedLocations, location]);
    setSearchValue("");
    setIsDropdownOpen(false);
  };

  const handleRemoveLocation = (criteriaId: number) => {
    onLocationsChange?.(selectedLocations.filter((loc) => loc.criteria_id !== criteriaId));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <label className="text-sm font-semibold leading-[18px] text-base-500">
            Location Targeting
          </label>
          {hasError && (
            <span className="text-xs leading-4 text-[#d14f34]">
              You need to select at least 1 location
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search for cities, counties, states or countries..."
            value={searchValue}
            onChange={handleSearchChange}
            onFocus={() => setIsDropdownOpen(true)}
            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
            className={cn(
              "h-10 w-full rounded-full border bg-white px-4 py-3 text-xs leading-4 placeholder:text-neutral-500 pr-10 outline-none",
              "border-neutral-300",
              "focus:border-base-600"
            )}
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-base-600" />

          {isDropdownOpen && searchValue.length >= 2 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg max-h-60 overflow-auto">
              {isLoading ? (
                <div className="p-3 text-sm text-neutral-500">Searching...</div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="p-3 text-sm text-neutral-500">No locations found</div>
              ) : (
                filteredSuggestions.map((location) => (
                  <button
                    key={location.criteria_id}
                    type="button"
                    className="w-full px-4 py-2 text-left hover:bg-neutral-50 flex items-center justify-between"
                    onClick={() => handleSelectLocation(location)}
                  >
                    <span className="text-sm">{location.canonical_name}</span>
                    <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
                      {location.target_type}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedLocations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedLocations.map((location) => (
              <div
                key={location.criteria_id}
                className="flex items-center gap-1 bg-base-100 text-base-700 px-3 py-1 rounded-full text-xs"
              >
                <span>{location.name}</span>
                <span className="text-base-400">({location.target_type})</span>
                <button
                  type="button"
                  onClick={() => handleRemoveLocation(location.criteria_id)}
                  className="ml-1 hover:text-base-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-[#5f7e78] bg-[#eaf5f3] p-4 max-w-[580px]">
        <Info className="h-4 w-4 text-[#0d342b] flex-shrink-0" />
        <p className="text-sm leading-[18px] text-[#081f1a]">
          For small businesses, a narrow local geographic focus is the best starting point.
        </p>
      </div>
    </div>
  );
}
