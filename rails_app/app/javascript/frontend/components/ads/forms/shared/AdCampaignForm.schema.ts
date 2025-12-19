import { z } from "zod";
import { Ads } from "@shared";

export const headlineSchema = Ads.AssetSchema;

// export const headlineSchema = z.object({
//   value: z
//     .string()
//     .min(1, "Headline cannot be empty")
//     .max(30, "Google enforces a 30-character limit for headlines"),
//   isLocked: z.boolean(),
// });

export const descriptionSchema = Ads.AssetSchema;

export const featureSchema = Ads.AssetSchema;

export const adCampaignSchema = z.object({
  adGroupName: z.string().min(1, "Ad group name is required"),
  headlines: z
    .array(headlineSchema)
    .min(3, "At least 3 headlines required")
    .max(15, "Maximum 15 headlines allowed"),
  descriptions: z.array(descriptionSchema),
  features: z.array(featureSchema),
});

export type AdCampaignFormData = z.infer<typeof adCampaignSchema>;
export type HeadlineData = z.infer<typeof headlineSchema>;
export type DescriptionData = z.infer<typeof descriptionSchema>;
export type FeatureData = z.infer<typeof featureSchema>;
