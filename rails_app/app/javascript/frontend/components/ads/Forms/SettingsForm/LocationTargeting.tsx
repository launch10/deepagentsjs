import { useState, useMemo, useEffect, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Info, X, MapPin } from "lucide-react";
import { cn } from "@lib/utils";
import { useQuery } from "@tanstack/react-query";
import { usePage } from "@inertiajs/react";
import {
  GeoTargetConstantsService,
  type SearchGeoTargetConstantsResponse,
} from "@api/geoTargetConstants";
import type { CampaignProps } from "@components/ads/Sidebar/WorkflowBuddy/ad-campaign.types";
import { useFormRegistration } from "@hooks/useFormRegistration";

type GeoTarget = NonNullable<SearchGeoTargetConstantsResponse>[number];

const LocationSchema = z.object({
  criteria_id: z.number(),
  name: z.string(),
  canonical_name: z.string(),
  target_type: z.string(),
  country_code: z.string(),
  radius: z.number().min(1),
  isTargeted: z.boolean(),
});

const locationFormSchema = z.object({
  locations: z.array(LocationSchema).min(1, "You need to select at least 1 location"),
});

type LocationFormData = z.infer<typeof locationFormSchema>;
export type LocationWithSettings = z.infer<typeof LocationSchema>;

export default function LocationTargeting() {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const methods = useForm<LocationFormData>({
    resolver: zodResolver(locationFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      locations: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: methods.control,
    name: "locations",
  });

  useFormRegistration("settings", methods);

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
    (s) => !fields.some((loc) => loc.criteria_id === s.criteria_id)
  );

  const hasError = methods.formState.errors.locations?.message;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setIsDropdownOpen(true);
  };

  const handleSelectLocation = (location: GeoTarget) => {
    if (!location) {
      console.warn("Invalid location selected", location);
      return;
    }

    const newLocation: LocationWithSettings = {
      criteria_id: location.criteria_id,
      name: location.name,
      canonical_name: location.canonical_name,
      target_type: location.target_type,
      country_code: location.country_code!,
      radius: 10,
      isTargeted: true,
    };
    append(newLocation);
    setSearchValue("");
    setDebouncedSearchValue("");
    setIsDropdownOpen(false);
  };

  const handleRemoveLocation = (index: number) => {
    remove(index);
  };

  const handleRadiusChange = (index: number, radius: number) => {
    const current = fields[index];
    update(index, { ...current, radius });
  };

  const handleToggleTargeted = (index: number) => {
    const current = fields[index];
    update(index, { ...current, isTargeted: !current.isTargeted });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <label className="text-sm font-semibold leading-[18px] text-base-500">
            Location Targeting
          </label>
          {hasError && <span className="text-xs leading-4 text-[#d14f34]">{hasError}</span>}
        </div>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search for cities, counties, states or countries..."
            value={searchValue}
            onChange={handleSearchChange}
            onFocus={() => setIsDropdownOpen(true)}
            className={cn(
              "h-10 w-full rounded-full border bg-white px-4 py-3 text-xs leading-4 placeholder:text-neutral-500 pr-10 outline-none",
              "border-neutral-300",
              "focus:border-base-600"
            )}
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-base-600" />

          {isDropdownOpen && searchValue.length >= 2 && (
            <div
              ref={dropdownRef}
              className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg max-h-60 overflow-auto"
            >
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectLocation(location);
                    }}
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

        <div className="flex items-center gap-3 rounded-lg border border-[#5f7e78] bg-[#eaf5f3] p-4 max-w-[580px]">
          <Info className="h-4 w-4 text-[#0d342b] flex-shrink-0" />
          <p className="text-sm leading-[18px] text-[#081f1a]">
            For small businesses, a narrow local geographic focus is the best starting point.
          </p>
        </div>

        {fields.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {fields.map((location, index) => (
              <div
                key={location.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-neutral-400" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-neutral-900">
                      {location.canonical_name}
                    </span>
                    <span className="text-xs text-neutral-400">{location.target_type}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Radius:</span>
                    <Controller
                      name={`locations.${index}.radius`}
                      control={methods.control}
                      render={({ field }) => (
                        <input
                          type="number"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          className="w-12 h-8 rounded border border-neutral-300 px-2 text-sm text-center"
                        />
                      )}
                    />
                    <span className="text-xs text-neutral-500">miles</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Excluded</span>
                    <button
                      type="button"
                      onClick={() => handleToggleTargeted(index)}
                      className={cn(
                        "relative w-11 h-6 rounded-full transition-colors",
                        location.isTargeted ? "bg-neutral-900" : "bg-neutral-300"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                          location.isTargeted ? "left-6" : "left-1"
                        )}
                      />
                    </button>
                    <span className="text-xs text-neutral-500">Targeted</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveLocation(index)}
                    className="p-1 hover:bg-neutral-100 rounded"
                  >
                    <X className="h-4 w-4 text-neutral-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
