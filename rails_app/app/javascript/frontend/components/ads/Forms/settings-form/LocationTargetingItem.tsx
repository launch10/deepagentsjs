import { Button } from "@components/ui/button";
import { Label } from "@components/ui/label";
import { Switch } from "@components/ui/switch";
import { cn } from "@lib/utils";
import { MapPin, X } from "lucide-react";
import { Controller, useFormContext, type FieldArrayWithId } from "react-hook-form";
import type { SettingsFormData } from "./settingsForm.schema";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";

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
      className="flex items-center justify-between rounded-lg border border-neutral-300 bg-white px-4 py-3 gap-4"
    >
      <div className="flex items-center gap-3">
        <MapPin className="h-4 w-4 text-base-500" />
        <div className="flex flex-col">
          <span className="text-xs font-medium text-base-500">{location.canonical_name}</span>
          <span className="text-xs text-base-300">{location.target_type}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-none">
        <span className="text-xs text-base-300">Radius:</span>
        <InputGroup className="w-24">
          <Controller
            name={`locations.${index}.radius`}
            control={methods.control}
            render={({ field }) => (
              <InputGroupInput
                className="text-xs text-base-500"
                type="number"
                {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
              />
            )}
          />
          <InputGroupAddon className="text-xs text-base-300" align="inline-end">
            miles
          </InputGroupAddon>
        </InputGroup>
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
      <Button variant="ghost" size="icon" onClick={() => handleRemoveLocation(index)}>
        <X className="h-4 w-4 text-base-500" />
      </Button>
    </div>
  );
}

export default LocationTargetingItem;
