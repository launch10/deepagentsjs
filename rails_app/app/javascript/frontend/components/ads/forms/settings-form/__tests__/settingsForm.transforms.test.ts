import { describe, it, expect } from "vitest";
import {
  transformLocationsToApi,
  transformLocationsFromApi,
  transformScheduleToApi,
  transformScheduleFromApi,
  transformSettingsFormToApi,
  transformBudgetFromApi,
} from "../settingsForm.transforms";
import type { SettingsFormData, LocationWithSettings } from "../settingsForm.schema";
import { settingsFormDefaults } from "../settingsForm.schema";

describe("settingsForm.transforms", () => {
  describe("transformLocationsToApi", () => {
    it("transforms locations to API format", () => {
      const locations: LocationWithSettings[] = [
        {
          criteria_id: 1014221,
          name: "New York",
          canonical_name: "New York, United States",
          target_type: "CITY",
          country_code: "US",
          isTargeted: true,
        },
      ];

      const result = transformLocationsToApi(locations);

      expect(result).toEqual([
        {
          target_type: "geo_location",
          location_name: "New York",
          country_code: "US",
          targeted: true,
          google_criterion_id: "1014221",
        },
      ]);
    });

    it("transforms multiple locations", () => {
      const locations: LocationWithSettings[] = [
        {
          criteria_id: 1014221,
          name: "New York",
          canonical_name: "New York, United States",
          target_type: "CITY",
          country_code: "US",
          isTargeted: true,
        },
        {
          criteria_id: 1014044,
          name: "Los Angeles",
          canonical_name: "Los Angeles, United States",
          target_type: "CITY",
          country_code: "US",
          isTargeted: false,
        },
      ];

      const result = transformLocationsToApi(locations);

      expect(result).toHaveLength(2);
      expect(result[0].location_name).toBe("New York");
      expect(result[0].targeted).toBe(true);
      expect(result[1].location_name).toBe("Los Angeles");
      expect(result[1].targeted).toBe(false);
    });

    it("handles empty locations array", () => {
      expect(transformLocationsToApi([])).toEqual([]);
    });
  });

  describe("transformLocationsFromApi", () => {
    it("transforms API locations to form format", () => {
      const apiLocations = [
        {
          target_type: "geo_location",
          location_name: "New York",
          country_code: "US",
          targeted: true,
          geo_target_constant: "geoTargetConstants/1014221",
          location_type: "CITY",
        },
      ];

      const result = transformLocationsFromApi(apiLocations);

      expect(result).toEqual([
        {
          criteria_id: 1014221,
          name: "New York",
          canonical_name: "New York",
          target_type: "CITY",
          country_code: "US",
          isTargeted: true,
        },
      ]);
    });

    it("returns empty array for null input", () => {
      expect(transformLocationsFromApi(null)).toEqual([]);
    });

    it("returns empty array for undefined input", () => {
      expect(transformLocationsFromApi(undefined)).toEqual([]);
    });

    it("returns empty array for empty array", () => {
      expect(transformLocationsFromApi([])).toEqual([]);
    });

    it("filters out non-geo_location targets", () => {
      const apiLocations = [
        {
          target_type: "geo_location",
          location_name: "New York",
          country_code: "US",
          targeted: true,
          geo_target_constant: "geoTargetConstants/1014221",
          location_type: "CITY",
        },
        {
          target_type: "proximity",
          location_name: "Some Address",
          country_code: "US",
          targeted: true,
          geo_target_constant: null,
        },
      ];

      const result = transformLocationsFromApi(apiLocations);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("New York");
    });
  });

  describe("transformScheduleToApi", () => {
    it("transforms always-on schedule", () => {
      const formData: SettingsFormData = {
        ...settingsFormDefaults,
        selectedDays: ["Mon", "Tues", "Wed", "Thu", "Fri", "Sat", "Sun", "Always On"],
      };

      const result = transformScheduleToApi(formData);

      expect(result).toEqual({ always_on: true });
    });

    it("transforms specific days schedule", () => {
      const formData: SettingsFormData = {
        ...settingsFormDefaults,
        selectedDays: ["Mon", "Wed", "Fri"],
        startTime: "09:00",
        endTime: "17:00",
        timezone: "EST",
      };

      const result = transformScheduleToApi(formData);

      expect(result).toEqual({
        always_on: false,
        day_of_week: ["Monday", "Wednesday", "Friday"],
        start_time: "09:00",
        end_time: "17:00",
        time_zone: "America/New_York",
      });
    });

    it("maps timezone abbreviations to IANA format", () => {
      const formData: SettingsFormData = {
        ...settingsFormDefaults,
        selectedDays: ["Mon"],
        timezone: "PST",
      };

      const result = transformScheduleToApi(formData);

      expect(result).toHaveProperty("time_zone", "America/Los_Angeles");
    });

    it("passes through unknown timezones as-is", () => {
      const formData: SettingsFormData = {
        ...settingsFormDefaults,
        selectedDays: ["Mon"],
        timezone: "Europe/London",
      };

      const result = transformScheduleToApi(formData);

      expect(result).toHaveProperty("time_zone", "Europe/London");
    });
  });

  describe("transformScheduleFromApi", () => {
    it("returns defaults for null schedule", () => {
      const result = transformScheduleFromApi(null);

      expect(result).toEqual({
        selectedDays: settingsFormDefaults.selectedDays,
        startTime: settingsFormDefaults.startTime,
        endTime: settingsFormDefaults.endTime,
        timezone: settingsFormDefaults.timezone,
      });
    });

    it("transforms always-on schedule from API", () => {
      const apiSchedule = {
        always_on: true,
        time_zone: "America/New_York",
      };

      const result = transformScheduleFromApi(apiSchedule as any);

      expect(result.selectedDays).toContain("Always On");
      expect(result.selectedDays).toContain("Mon");
      expect(result.startTime).toBe("00:00");
      expect(result.endTime).toBe("23:59");
    });

    it("transforms specific days schedule from API", () => {
      const apiSchedule = {
        always_on: false,
        day_of_week: ["Monday", "Wednesday", "Friday"],
        start_time: "9:00am",
        end_time: "5:00pm",
        time_zone: "America/New_York",
      };

      const result = transformScheduleFromApi(apiSchedule as any);

      expect(result.selectedDays).toEqual(["Mon", "Wed", "Fri"]);
      expect(result.startTime).toBe("09:00");
      expect(result.endTime).toBe("17:00");
      expect(result.timezone).toBe("EST");
    });

    it("maps IANA timezones to abbreviations", () => {
      const apiSchedule = {
        always_on: false,
        day_of_week: ["Monday"],
        start_time: "9:00am",
        end_time: "5:00pm",
        time_zone: "America/Los_Angeles",
      };

      const result = transformScheduleFromApi(apiSchedule as any);

      expect(result.timezone).toBe("PST");
    });
  });

  describe("transformBudgetFromApi", () => {
    it("converts cents to dollars", () => {
      expect(transformBudgetFromApi(50000)).toBe(500);
      expect(transformBudgetFromApi(10000)).toBe(100);
      expect(transformBudgetFromApi(2550)).toBe(25.5);
    });

    it("returns default for null", () => {
      expect(transformBudgetFromApi(null)).toBe(settingsFormDefaults.budget);
    });

    it("returns default for undefined", () => {
      expect(transformBudgetFromApi(undefined)).toBe(settingsFormDefaults.budget);
    });

    it("returns default for zero", () => {
      expect(transformBudgetFromApi(0)).toBe(settingsFormDefaults.budget);
    });
  });

  describe("transformSettingsFormToApi (full roundtrip)", () => {
    it("transforms complete form data to API format", () => {
      const formData: SettingsFormData = {
        locations: [
          {
            criteria_id: 1014221,
            name: "New York",
            canonical_name: "New York, United States",
            target_type: "CITY",
            country_code: "US",
            isTargeted: true,
          },
        ],
        selectedDays: ["Mon", "Wed", "Fri"],
        startTime: "09:00",
        endTime: "17:00",
        timezone: "EST",
        budget: 500,
      };

      const result = transformSettingsFormToApi(formData);

      expect(result).toEqual({
        location_targets: [
          {
            target_type: "geo_location",
            location_name: "New York",
            country_code: "US",
            targeted: true,
            google_criterion_id: "1014221",
          },
        ],
        ad_schedules: {
          always_on: false,
          day_of_week: ["Monday", "Wednesday", "Friday"],
          start_time: "09:00",
          end_time: "17:00",
          time_zone: "America/New_York",
        },
        daily_budget_cents: 50000,
      });
    });
  });
});
