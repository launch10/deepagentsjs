import { Button } from "@components/ui/button";
import { Label } from "@components/ui/label";
import { Switch } from "@components/ui/switch";
import { cn } from "@lib/utils";
import { MapPin, X } from "lucide-react";
import { Controller, useFormContext, type FieldArrayWithId } from "react-hook-form";
import type { SettingsFormData } from "./settingsForm.schema";

type SettingsFormInputProps = {
  location: FieldArrayWithId<SettingsFormData, "locations", "id">;
  index: number;
  handleRemoveLocation: (index: number) => void;
  handleToggleTargeted: (index: number) => void;
};

function LocationTargetingItem({
  location,
  index,
  handleRemoveLocation,
  handleToggleTargeted,
}: SettingsFormInputProps) {
  const methods = useFormContext<SettingsFormData>();
  return (
    <div
      key={location.id}
      data-testid={`location-item-${location.criteria_id}`}
      data-targeted={location.isTargeted}
      className="flex items-center justify-between rounded-lg border border-neutral-300 bg-white px-4 py-3 gap-4"
    >
      <div className="flex items-center gap-3">
        <MapPin className="h-4 w-4 text-base-500" />
        <div className="flex flex-col">
          <span data-testid="location-name" className="text-xs font-medium text-base-500">{location.canonical_name}</span>
          <span data-testid="location-type" className="text-xs text-base-300">{location.target_type}</span>
        </div>
      </div>
      <div className="flex items-center space-x-2 ml-auto">
        <Label htmlFor={`locations.${index}.isTargeted`} className="text-xs text-base-400 mb-0">
          Excluded
        </Label>
        <Controller
          name={`locations.${index}.isTargeted`}
          control={methods.control}
          render={({ field }) => (
            <Switch
              id={`locations.${index}.isTargeted`}
              data-testid={`location-toggle-${location.criteria_id}`}
              checked={field.value}
              onCheckedChange={() => handleToggleTargeted(index)}
              className={cn(
                "transition-colors duration-200",
                field.value && "bg-black data-[state=checked]:bg-black"
              )}
            />
          )}
        />
        <Label
          htmlFor={`locations.${index}.isTargeted`}
          className={cn(
            "text-xs mb-0",
            location.isTargeted ? "font-medium text-base-600" : "text-base-400"
          )}
        >
          Targeted
        </Label>
      </div>
      <Button
        variant="ghost"
        size="icon"
        data-testid={`location-remove-${location.criteria_id}`}
        onClick={() => handleRemoveLocation(index)}
      >
        <X className="h-4 w-4 text-base-500" />
      </Button>
    </div>
  );
}

export default LocationTargetingItem;
