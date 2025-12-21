import { z } from "zod";

// API enum values for Google Advertising Channel Types
export const GOOGLE_ADVERTISING_CHANNEL_TYPES = {
  SEARCH: {
    label: "Google Search",
    description: "Shows ads in Google search results",
  },
  DISPLAY: {
    label: "Display Network",
    description: "Shows ads across websites and apps",
  },
  SHOPPING: {
    label: "Shopping",
    description: "Shows product listings in search results",
  },
  VIDEO: {
    label: "Video (YouTube)",
    description: "Shows video ads on YouTube",
  },
  MULTI_CHANNEL: {
    label: "Multi-channel",
    description: "Shows ads across multiple channels",
  },
} as const;

// API enum values for Google Bidding Strategies
export const GOOGLE_BIDDING_STRATEGIES = {
  MAXIMIZE_CLICKS: {
    label: "Maximum Clicks",
    description: "Get the most clicks for your budget",
  },
  MAXIMIZE_CONVERSIONS: {
    label: "Maximum Conversions",
    description: "Get the most conversions for your budget",
  },
  TARGET_CPA: {
    label: "Target CPA",
    description: "Set a target cost per acquisition",
  },
  TARGET_ROAS: {
    label: "Target ROAS",
    description: "Set a target return on ad spend",
  },
  MANUAL_CPC: {
    label: "Manual CPC",
    description: "Set your own cost per click bids",
  },
} as const;

export type GoogleAdvertisingChannelType = keyof typeof GOOGLE_ADVERTISING_CHANNEL_TYPES;
export type GoogleBiddingStrategy = keyof typeof GOOGLE_BIDDING_STRATEGIES;

export const launchFormSchema = z
  .object({
    campaignName: z.string().min(1, "Campaign name is required"),
    googleAdvertisingChannelType: z
      .enum(["SEARCH", "DISPLAY", "SHOPPING", "VIDEO", "MULTI_CHANNEL"])
      .default("SEARCH"),
    googleBiddingStrategy: z
      .enum(["MAXIMIZE_CLICKS", "MAXIMIZE_CONVERSIONS", "TARGET_CPA", "TARGET_ROAS", "MANUAL_CPC"])
      .default("MAXIMIZE_CLICKS"),
    startDate: z.date({ required_error: "Start date is required" }),
    endDate: z.date().optional(),
  })
  .refine(
    (data) => {
      // Only validate if endDate is provided
      if (!data.endDate) {
        return true;
      }
      // Normalize dates to midnight for accurate date-only comparison
      const start = new Date(data.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(data.endDate);
      end.setHours(0, 0, 0, 0);
      return end > start;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    }
  );

export type LaunchFormData = z.infer<typeof launchFormSchema>;

export const launchFormDefaults: LaunchFormData = {
  campaignName: "",
  googleAdvertisingChannelType: "SEARCH",
  googleBiddingStrategy: "MAXIMIZE_CLICKS",
  startDate: new Date(),
  endDate: undefined,
};

// Legacy exports for backward compatibility
export const CAMPAIGN_TYPES = GOOGLE_ADVERTISING_CHANNEL_TYPES;
export const BIDDING_STRATEGIES = GOOGLE_BIDDING_STRATEGIES;
