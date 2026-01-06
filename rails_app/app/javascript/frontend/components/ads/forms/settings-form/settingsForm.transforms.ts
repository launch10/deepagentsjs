import type { SettingsFormData, LocationWithSettings } from "./settingsForm.schema";
import { settingsFormDefaults } from "./settingsForm.schema";
import type { CampaignProps } from "@components/ads/workflow-panel/workflow-buddy/ad-campaign.types";

type ApiLocationTarget = NonNullable<CampaignProps["location_targets"]>[number];
type ApiSchedule = NonNullable<CampaignProps["ad_schedule"]>;

const DAY_NAME_MAP: Record<string, string> = {
  Mon: "Monday",
  Tues: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const TIMEZONE_MAP: Record<string, string> = {
  EST: "America/New_York",
  CST: "America/Chicago",
  MST: "America/Denver",
  PST: "America/Los_Angeles",
};

const REVERSE_DAY_NAME_MAP = Object.fromEntries(
  Object.entries(DAY_NAME_MAP).map(([k, v]) => [v, k])
);

const REVERSE_TIMEZONE_MAP = Object.fromEntries(
  Object.entries(TIMEZONE_MAP).map(([k, v]) => [v, k])
);

export function transformLocationsToApi(locations: LocationWithSettings[]) {
  // Send GeoTargetConstant format directly - backend handles normalization
  return locations.map((loc) => ({
    criteria_id: loc.criteria_id,
    name: loc.name,
    target_type: loc.target_type,
    country_code: loc.country_code,
    targeted: loc.isTargeted,
  }));
}

export function transformScheduleToApi(formData: SettingsFormData) {
  const isAlwaysOn = formData.selectedDays.includes("Always On");

  if (isAlwaysOn) {
    return { always_on: true };
  }

  return {
    always_on: false,
    day_of_week: formData.selectedDays
      .filter((day) => day !== "Always On")
      .map((day) => DAY_NAME_MAP[day]),
    start_time: formData.startTime,
    end_time: formData.endTime,
    time_zone: TIMEZONE_MAP[formData.timezone] || formData.timezone,
  };
}

export function transformSettingsFormToApi(formData: SettingsFormData) {
  return {
    location_targets: transformLocationsToApi(formData.locations),
    ad_schedules: transformScheduleToApi(formData),
    daily_budget_cents: formData.budget * 100,
  };
}

export function transformLocationsFromApi(
  locations: ApiLocationTarget[] | null | undefined
): LocationWithSettings[] {
  if (!locations || locations.length === 0) return [];

  // Filter out radius targets (they don't have criteria_id) and map geo locations
  return locations
    .filter((loc) => loc.criteria_id != null)
    .map((loc) => ({
      criteria_id: loc.criteria_id!,
      name: loc.name || "",
      canonical_name: loc.name || "",
      target_type: loc.target_type || "Country",
      country_code: loc.country_code || "",
      isTargeted: loc.targeted ?? true,
    }));
}

function parseTimeToHHMM(timeStr: string | null): string {
  if (!timeStr) return "09:00";
  const match = timeStr.match(/(\d{1,2}):(\d{2})(am|pm)/i);
  if (!match) return "09:00";
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toLowerCase();
  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

export function transformScheduleFromApi(
  schedule: ApiSchedule | null | undefined
): Pick<SettingsFormData, "selectedDays" | "startTime" | "endTime" | "timezone"> {
  if (!schedule) {
    return {
      selectedDays: settingsFormDefaults.selectedDays,
      startTime: settingsFormDefaults.startTime,
      endTime: settingsFormDefaults.endTime,
      timezone: settingsFormDefaults.timezone,
    };
  }

  if (schedule.always_on) {
    return {
      selectedDays: ["Mon", "Tues", "Wed", "Thu", "Fri", "Sat", "Sun", "Always On"],
      startTime: "00:00",
      endTime: "23:59",
      timezone:
        (schedule.time_zone && REVERSE_TIMEZONE_MAP[schedule.time_zone]) ||
        settingsFormDefaults.timezone,
    };
  }

  const dayOfWeek = schedule.day_of_week ?? [];
  const selectedDays = dayOfWeek.map((day) => REVERSE_DAY_NAME_MAP[day]).filter(Boolean);

  return {
    selectedDays: selectedDays.length > 0 ? selectedDays : settingsFormDefaults.selectedDays,
    startTime: parseTimeToHHMM(schedule.start_time ?? null),
    endTime: parseTimeToHHMM(schedule.end_time ?? null),
    timezone:
      (schedule.time_zone && REVERSE_TIMEZONE_MAP[schedule.time_zone]) ||
      settingsFormDefaults.timezone,
  };
}

export function transformBudgetFromApi(dailyBudgetCents: number | null | undefined): number {
  if (!dailyBudgetCents) return settingsFormDefaults.budget;
  return dailyBudgetCents / 100;
}
