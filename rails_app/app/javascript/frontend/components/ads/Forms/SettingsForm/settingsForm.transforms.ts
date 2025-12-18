import type { SettingsFormData, LocationWithSettings } from "./settingsForm.schema";

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

export function transformLocationsToApi(locations: LocationWithSettings[]) {
  return locations.map((loc) => ({
    target_type: "geo_location", // TODO: Add support for other target types
    location_name: loc.name,
    country_code: loc.country_code,
    targeted: loc.isTargeted,
    google_criterion_id: String(loc.criteria_id),
    radius: loc.radius,
    radius_units: "MILES",
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
    start_time: formData.startTime, // TODO: Add PM/AM to the time
    end_time: formData.endTime, // TODO: Add PM/AM to the time
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
