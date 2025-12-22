import { z } from "zod";

const LocationSchema = z.object({
  criteria_id: z.number(),
  name: z.string(),
  canonical_name: z.string(),
  target_type: z.string(),
  country_code: z.string(),
  radius: z.number().min(1),
  isTargeted: z.boolean(),
});

const VALID_MINUTES = ["00", "15", "30", "45"] as const;

const timeSchema = z.string().refine(
  (val) => {
    const match = val.match(/^(\d{2}):(\d{2})$/);
    if (!match) return false;
    const [, hours, minutes] = match;
    const h = parseInt(hours, 10);
    const validMinute = VALID_MINUTES.includes(minutes as (typeof VALID_MINUTES)[number]);
    return h >= 0 && h <= 23 && validMinute;
  },
  { message: "Time must be in 15-minute increments (00, 15, 30, 45)" }
);

export const settingsFormSchema = z.object({
  locations: z.array(LocationSchema).refine((locs) => locs.some((loc) => loc.isTargeted), {
    message: "Must have at least 1 targeted location",
  }),
  selectedDays: z.array(z.string()).min(1, "Select at least one day"),
  startTime: timeSchema,
  endTime: timeSchema,
  timezone: z.string().min(1, "Timezone is required"),
  budget: z.number().min(1, "Budget must be at least $1"),
});

export type SettingsFormData = z.infer<typeof settingsFormSchema>;
export type LocationWithSettings = z.infer<typeof LocationSchema>;

export const settingsFormDefaults: SettingsFormData = {
  locations: [],
  selectedDays: ["Mon", "Tues", "Wed", "Thu", "Fri"],
  startTime: "09:00",
  endTime: "17:00",
  timezone: "EST",
  budget: 500,
};
