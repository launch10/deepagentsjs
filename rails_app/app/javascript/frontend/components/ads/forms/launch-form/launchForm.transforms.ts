import type { LaunchFormData } from "./launchForm.schema";
import { launchFormDefaults } from "./launchForm.schema";
import { formatDateForApi } from "@helpers/formatDateForApi";

export interface LaunchFormApiData {
  name?: string;
  google_advertising_channel_type?: string;
  google_bidding_strategy?: string;
  start_date?: string;
  end_date?: string;
}

export function transformLaunchFormToApi(formData: LaunchFormData): LaunchFormApiData {
  return {
    name: formData.campaignName || undefined,
    google_advertising_channel_type: formData.googleAdvertisingChannelType,
    google_bidding_strategy: formData.googleBiddingStrategy,
    start_date: formatDateForApi(formData.startDate),
    end_date: formatDateForApi(formData.endDate),
  };
}

function parseDateFromApi(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
}

export function transformNameFromApi(name: string | null | undefined): string {
  return name || launchFormDefaults.campaignName;
}

export function transformChannelTypeFromApi(
  channelType: string | null | undefined
): LaunchFormData["googleAdvertisingChannelType"] {
  const validTypes = ["SEARCH", "DISPLAY", "SHOPPING", "VIDEO", "MULTI_CHANNEL"] as const;
  if (channelType && validTypes.includes(channelType as any)) {
    return channelType as LaunchFormData["googleAdvertisingChannelType"];
  }
  return launchFormDefaults.googleAdvertisingChannelType;
}

export function transformBiddingStrategyFromApi(
  strategy: string | null | undefined
): LaunchFormData["googleBiddingStrategy"] {
  const validStrategies = [
    "MAXIMIZE_CLICKS",
    "MAXIMIZE_CONVERSIONS",
    "TARGET_CPA",
    "TARGET_ROAS",
    "MANUAL_CPC",
  ] as const;
  if (strategy && validStrategies.includes(strategy as any)) {
    return strategy as LaunchFormData["googleBiddingStrategy"];
  }
  return launchFormDefaults.googleBiddingStrategy;
}

export function transformStartDateFromApi(dateStr: string | null | undefined): Date {
  const parsed = parseDateFromApi(dateStr);
  return parsed || launchFormDefaults.startDate;
}

export function transformEndDateFromApi(dateStr: string | null | undefined): Date | undefined {
  return parseDateFromApi(dateStr);
}

export interface ApiCampaignData {
  name?: string | null;
  google_advertising_channel_type?: string | null;
  google_bidding_strategy?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export function transformLaunchFormFromApi(
  campaign: ApiCampaignData | null | undefined
): LaunchFormData {
  if (!campaign) {
    return { ...launchFormDefaults };
  }

  return {
    campaignName: transformNameFromApi(campaign.name),
    googleAdvertisingChannelType: transformChannelTypeFromApi(
      campaign.google_advertising_channel_type
    ),
    googleBiddingStrategy: transformBiddingStrategyFromApi(campaign.google_bidding_strategy),
    startDate: transformStartDateFromApi(campaign.start_date),
    endDate: transformEndDateFromApi(campaign.end_date),
  };
}
