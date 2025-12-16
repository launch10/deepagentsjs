import { useState } from "react";
import { Search, Info } from "lucide-react";
import { cn } from "@lib/utils";

export default function LocationTargeting() {
  const [searchValue, setSearchValue] = useState("");
  const [error] = useState<string | null>("You need to select at least 1 location");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <label className="text-sm font-semibold leading-[18px] text-base-500">
            Location Targeting
          </label>
          {error && (
            <span className="text-xs leading-4 text-[#d14f34]">{error}</span>
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search for cities, counties, states or countries..."
            value={searchValue}
            onChange={handleSearchChange}
            className={cn(
              "h-10 w-full rounded-full border bg-white px-4 py-3 text-xs leading-4 placeholder:text-neutral-500 pr-10 outline-none",
              error ? "border-neutral-300" : "border-neutral-300",
              "focus:border-base-600"
            )}
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-base-600" />
        </div>
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
