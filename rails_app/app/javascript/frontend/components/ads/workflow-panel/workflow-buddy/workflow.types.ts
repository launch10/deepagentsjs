import type { InertiaProps } from "@shared";

export type SubStepType = {
  label: string;
  isSubStepActive?: boolean;
  isSubStepCompleted?: boolean;
};

export type CampaignProps =
  InertiaProps.paths["/projects/{uuid}/campaigns/content"]["get"]["responses"]["200"]["content"]["application/json"];

export type AdCampaignChatFormType = {
  message: string;
};

export type AdPreviewType = {
  headline: string;
  url: string;
  details: string;
};
