import { describe, it, expect } from "vitest";
import {
  transformLaunchFormToApi,
  transformLaunchFormFromApi,
  transformNameFromApi,
  transformChannelTypeFromApi,
  transformBiddingStrategyFromApi,
  transformStartDateFromApi,
  transformEndDateFromApi,
} from "../launchForm.transforms";
import type { LaunchFormData } from "../launchForm.schema";
import { launchFormDefaults } from "../launchForm.schema";

describe("launchForm.transforms", () => {
  describe("transformLaunchFormToApi", () => {
    it("transforms complete form data to API format", () => {
      const formData: LaunchFormData = {
        campaignName: "My Campaign",
        googleAdvertisingChannelType: "SEARCH",
        googleBiddingStrategy: "MAXIMIZE_CLICKS",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-02-15"),
      };

      const result = transformLaunchFormToApi(formData);

      expect(result).toEqual({
        name: "My Campaign",
        google_advertising_channel_type: "SEARCH",
        google_bidding_strategy: "MAXIMIZE_CLICKS",
        start_date: "2024-01-15",
        end_date: "2024-02-15",
      });
    });

    it("handles undefined end date", () => {
      const formData: LaunchFormData = {
        campaignName: "My Campaign",
        googleAdvertisingChannelType: "SEARCH",
        googleBiddingStrategy: "MAXIMIZE_CLICKS",
        startDate: new Date("2024-01-15"),
        endDate: undefined,
      };

      const result = transformLaunchFormToApi(formData);

      expect(result.end_date).toBeUndefined();
    });

    it("handles empty campaign name", () => {
      const formData: LaunchFormData = {
        campaignName: "",
        googleAdvertisingChannelType: "SEARCH",
        googleBiddingStrategy: "MAXIMIZE_CLICKS",
        startDate: new Date("2024-01-15"),
        endDate: undefined,
      };

      const result = transformLaunchFormToApi(formData);

      expect(result.name).toBeUndefined();
    });
  });

  describe("transformNameFromApi", () => {
    it("returns the name when provided", () => {
      expect(transformNameFromApi("My Campaign")).toBe("My Campaign");
    });

    it("returns default for null", () => {
      expect(transformNameFromApi(null)).toBe(launchFormDefaults.campaignName);
    });

    it("returns default for undefined", () => {
      expect(transformNameFromApi(undefined)).toBe(launchFormDefaults.campaignName);
    });

    it("returns default for empty string", () => {
      expect(transformNameFromApi("")).toBe(launchFormDefaults.campaignName);
    });
  });

  describe("transformChannelTypeFromApi", () => {
    it("returns valid channel types", () => {
      expect(transformChannelTypeFromApi("SEARCH")).toBe("SEARCH");
      expect(transformChannelTypeFromApi("DISPLAY")).toBe("DISPLAY");
      expect(transformChannelTypeFromApi("SHOPPING")).toBe("SHOPPING");
      expect(transformChannelTypeFromApi("VIDEO")).toBe("VIDEO");
      expect(transformChannelTypeFromApi("MULTI_CHANNEL")).toBe("MULTI_CHANNEL");
    });

    it("returns default for invalid type", () => {
      expect(transformChannelTypeFromApi("INVALID")).toBe(
        launchFormDefaults.googleAdvertisingChannelType
      );
    });

    it("returns default for null", () => {
      expect(transformChannelTypeFromApi(null)).toBe(
        launchFormDefaults.googleAdvertisingChannelType
      );
    });

    it("returns default for undefined", () => {
      expect(transformChannelTypeFromApi(undefined)).toBe(
        launchFormDefaults.googleAdvertisingChannelType
      );
    });
  });

  describe("transformBiddingStrategyFromApi", () => {
    it("returns valid bidding strategies", () => {
      expect(transformBiddingStrategyFromApi("MAXIMIZE_CLICKS")).toBe("MAXIMIZE_CLICKS");
      expect(transformBiddingStrategyFromApi("MAXIMIZE_CONVERSIONS")).toBe("MAXIMIZE_CONVERSIONS");
      expect(transformBiddingStrategyFromApi("TARGET_CPA")).toBe("TARGET_CPA");
      expect(transformBiddingStrategyFromApi("TARGET_ROAS")).toBe("TARGET_ROAS");
      expect(transformBiddingStrategyFromApi("MANUAL_CPC")).toBe("MANUAL_CPC");
    });

    it("returns default for invalid strategy", () => {
      expect(transformBiddingStrategyFromApi("INVALID")).toBe(
        launchFormDefaults.googleBiddingStrategy
      );
    });

    it("returns default for null", () => {
      expect(transformBiddingStrategyFromApi(null)).toBe(launchFormDefaults.googleBiddingStrategy);
    });
  });

  describe("transformStartDateFromApi", () => {
    it("parses valid date string", () => {
      const result = transformStartDateFromApi("2024-01-15");
      expect(result.toISOString().split("T")[0]).toBe("2024-01-15");
    });

    it("returns default for null", () => {
      const result = transformStartDateFromApi(null);
      expect(result).toEqual(launchFormDefaults.startDate);
    });

    it("returns default for undefined", () => {
      const result = transformStartDateFromApi(undefined);
      expect(result).toEqual(launchFormDefaults.startDate);
    });

    it("returns default for invalid date string", () => {
      const result = transformStartDateFromApi("not-a-date");
      expect(result).toEqual(launchFormDefaults.startDate);
    });
  });

  describe("transformEndDateFromApi", () => {
    it("parses valid date string", () => {
      const result = transformEndDateFromApi("2024-02-15");
      expect(result?.toISOString().split("T")[0]).toBe("2024-02-15");
    });

    it("returns undefined for null", () => {
      expect(transformEndDateFromApi(null)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(transformEndDateFromApi(undefined)).toBeUndefined();
    });

    it("returns undefined for invalid date string", () => {
      expect(transformEndDateFromApi("not-a-date")).toBeUndefined();
    });
  });

  describe("transformLaunchFormFromApi", () => {
    it("transforms complete API data to form format", () => {
      const apiData = {
        name: "My Campaign",
        google_advertising_channel_type: "DISPLAY",
        google_bidding_strategy: "TARGET_CPA",
        start_date: "2024-01-15",
        end_date: "2024-02-15",
      };

      const result = transformLaunchFormFromApi(apiData);

      expect(result.campaignName).toBe("My Campaign");
      expect(result.googleAdvertisingChannelType).toBe("DISPLAY");
      expect(result.googleBiddingStrategy).toBe("TARGET_CPA");
      expect(result.startDate.toISOString().split("T")[0]).toBe("2024-01-15");
      expect(result.endDate?.toISOString().split("T")[0]).toBe("2024-02-15");
    });

    it("returns defaults for null campaign", () => {
      const result = transformLaunchFormFromApi(null);

      expect(result.campaignName).toBe(launchFormDefaults.campaignName);
      expect(result.googleAdvertisingChannelType).toBe(
        launchFormDefaults.googleAdvertisingChannelType
      );
      expect(result.googleBiddingStrategy).toBe(launchFormDefaults.googleBiddingStrategy);
    });

    it("returns defaults for undefined campaign", () => {
      const result = transformLaunchFormFromApi(undefined);

      expect(result.campaignName).toBe(launchFormDefaults.campaignName);
    });

    it("handles partial API data with defaults", () => {
      const apiData = {
        name: "Partial Campaign",
      };

      const result = transformLaunchFormFromApi(apiData);

      expect(result.campaignName).toBe("Partial Campaign");
      expect(result.googleAdvertisingChannelType).toBe(
        launchFormDefaults.googleAdvertisingChannelType
      );
      expect(result.googleBiddingStrategy).toBe(launchFormDefaults.googleBiddingStrategy);
    });
  });

  describe("roundtrip", () => {
    it("form -> API -> form preserves data", () => {
      const original: LaunchFormData = {
        campaignName: "Roundtrip Test",
        googleAdvertisingChannelType: "VIDEO",
        googleBiddingStrategy: "TARGET_ROAS",
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-03-31"),
      };

      const apiData = transformLaunchFormToApi(original);
      const result = transformLaunchFormFromApi(apiData);

      expect(result.campaignName).toBe(original.campaignName);
      expect(result.googleAdvertisingChannelType).toBe(original.googleAdvertisingChannelType);
      expect(result.googleBiddingStrategy).toBe(original.googleBiddingStrategy);
      expect(result.startDate.toISOString().split("T")[0]).toBe(
        original.startDate.toISOString().split("T")[0]
      );
      expect(result.endDate?.toISOString().split("T")[0]).toBe(
        original.endDate?.toISOString().split("T")[0]
      );
    });
  });
});
