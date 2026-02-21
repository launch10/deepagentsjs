import { z } from "zod";

const LocationSchema = z.object({
  criteria_id: z.number(),
  name: z.string(),
  canonical_name: z.string(),
  target_type: z.string(),
  country_code: z.string(),
  isTargeted: z.boolean(),
});

const VALID_MINUTES = ["00", "15", "30", "45"] as const;

function isValidTime(val: string): boolean {
  const match = val.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const [, hours, minutes] = match;
  const h = parseInt(hours, 10);
  const validMinute = VALID_MINUTES.includes(minutes as (typeof VALID_MINUTES)[number]);
  return h >= 0 && h <= 23 && validMinute;
}

export const settingsFormSchema = z
  .object({
    locations: z.array(LocationSchema).refine((locs) => locs.some((loc) => loc.isTargeted), {
      message: "Must have at least 1 targeted location",
    }),
    selectedDays: z.array(z.string()).min(1, "Select at least one day"),
    startTime: z.string(),
    endTime: z.string(),
    timezone: z.string().min(1, "Timezone is required"),
    budget: z.number().min(1, "Budget must be at least $1"),
  })
  .superRefine((data, ctx) => {
    const isAlwaysOn = data.selectedDays.includes("Always On");
    if (isAlwaysOn) return;

    if (!isValidTime(data.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Time must be in 15-minute increments (00, 15, 30, 45)",
        path: ["startTime"],
      });
    }

    if (!isValidTime(data.endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Time must be in 15-minute increments (00, 15, 30, 45)",
        path: ["endTime"],
      });
    }

    if (isValidTime(data.startTime) && isValidTime(data.endTime) && data.endTime <= data.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time",
        path: ["endTime"],
      });
    }
  });

export type SettingsFormData = z.infer<typeof settingsFormSchema>;
export type LocationWithSettings = z.infer<typeof LocationSchema>;

export const settingsFormDefaults: SettingsFormData = {
  locations: [],
  selectedDays: ["Mon", "Tues", "Wed", "Thu", "Fri"],
  startTime: "09:00",
  endTime: "17:00",
  timezone: "EST",
  budget: 10,
};
