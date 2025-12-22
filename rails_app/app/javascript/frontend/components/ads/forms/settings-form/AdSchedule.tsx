import { useFormContext, Controller, useFormState } from "react-hook-form";
import { Field, FieldError, FieldGroup, FieldLabel } from "@components/ui/field";
import { cn } from "@lib/utils";
import type { SettingsFormData } from "./settingsForm.schema";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@components/ui/select";
import { Button } from "@components/ui/button";

type DayOfWeek = "Mon" | "Tues" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun" | "Always On";

const DAYS: DayOfWeek[] = ["Mon", "Tues", "Wed", "Thu", "Fri", "Sat", "Sun", "Always On"];

const TIMEZONES = [
  { value: "EST", label: "Eastern Standard Time - EST (GMT-5)" },
  { value: "CST", label: "Central Standard Time - CST (GMT-6)" },
  { value: "MST", label: "Mountain Standard Time - MST (GMT-7)" },
  { value: "PST", label: "Pacific Standard Time - PST (GMT-8)" },
];

const TIME_OPTIONS = (() => {
  const options: { value: string; label: string; textValue: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of ["00", "15", "30", "45"]) {
      const value = `${hour.toString().padStart(2, "0")}:${minute}`;
      const h = hour % 12 || 12;
      const ampm = hour < 12 ? "AM" : "PM";
      const label = `${h}:${minute} ${ampm}`;
      const textValue = `${h}:${minute}`;
      options.push({ value, label, textValue });
    }
  }
  return options;
})();

export default function AdSchedule() {
  const { control, watch, getValues, setValue } = useFormContext<SettingsFormData>();
  const { errors } = useFormState({ control });

  const selectedDays = watch("selectedDays");
  const isAlwaysOn = selectedDays.includes("Always On");

  const toggleDay = (day: DayOfWeek) => {
    const current = getValues("selectedDays");
    let newSelected: string[];

    if (day === "Always On") {
      if (current.includes("Always On")) {
        newSelected = [];
      } else {
        newSelected = ["Mon", "Tues", "Wed", "Thu", "Fri", "Sat", "Sun", "Always On"];
      }
    } else {
      const withoutAlwaysOn = current.filter((d) => d !== "Always On");
      if (withoutAlwaysOn.includes(day)) {
        newSelected = withoutAlwaysOn.filter((d) => d !== day);
      } else {
        newSelected = [...withoutAlwaysOn, day];
      }
    }

    setValue("selectedDays", newSelected, { shouldValidate: true });
  };

  return (
    <FieldGroup className="gap-4">
      <Field className="flex flex-col gap-2">
        <FieldLabel className="text-sm font-semibold leading-[18px] text-base-500">
          Ad Schedule
        </FieldLabel>
        <div className="flex gap-2">
          {DAYS.map((day) => (
            <Button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              variant="outline"
              className={cn(
                "bg-white text-base-500 transition-colors hover:bg-neutral-50 ",
                selectedDays.includes(day)
                  ? "border-base-500 hover:border-base-600"
                  : "border-neutral-300 hover:border-neutral-500"
              )}
            >
              {day}
            </Button>
          ))}
        </div>
        <FieldError errors={[{ message: errors.selectedDays?.message }]} />
      </Field>

      {!isAlwaysOn && (
        <div className="flex gap-3 items-start">
          <Field className="flex flex-col gap-2 w-[212px]">
            <FieldLabel
              className="text-xs font-semibold leading-4 text-base-400"
              htmlFor="startTime"
            >
              Start Time
            </FieldLabel>
            <Controller
              name="startTime"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select start time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time.value} value={time.value} textValue={time.textValue}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[{ message: errors.startTime?.message }]} />
          </Field>
          <Field className="flex flex-col gap-2 w-[212px]">
            <FieldLabel className="text-xs font-semibold leading-4 text-base-400" htmlFor="endTime">
              End Time
            </FieldLabel>
            <Controller
              name="endTime"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select end time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time.value} value={time.value} textValue={time.textValue}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[{ message: errors.endTime?.message }]} />
          </Field>
          <Field className="flex flex-col gap-2 w-[313px]">
            <FieldLabel
              className="text-xs font-semibold leading-4 text-base-400"
              htmlFor="timezone"
            >
              Time Zone
            </FieldLabel>
            <Controller
              name="timezone"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[{ message: errors.timezone?.message }]} />
          </Field>
        </div>
      )}
    </FieldGroup>
  );
}
