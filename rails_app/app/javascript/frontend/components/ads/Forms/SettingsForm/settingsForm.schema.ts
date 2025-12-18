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

export const settingsFormSchema = z.object({
  locations: z.array(LocationSchema).min(1, "You need to select at least 1 location"),
  selectedDays: z.array(z.string()).min(1, "Select at least one day"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
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
