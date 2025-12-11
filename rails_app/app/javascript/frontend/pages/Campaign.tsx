import AdCampaignChat from "@components/ad-campaign/ad-campaign-chat/ad-campaign-chat";
import AdCampaignContent from "@components/ad-campaign/ad-campaign-create/ad-campaign-content";
import AdCampaignHighlights from "@components/ad-campaign/ad-campaign-create/ad-campaign-highlights";
import type { AdCampaignFormData } from "@components/ad-campaign/ad-campaign-form/ad-campaign-form.schema";
import { adCampaignSchema } from "@components/ad-campaign/ad-campaign-form/ad-campaign-form.schema";
import AdCampaignPagination from "@components/ad-campaign/ad-campaign-pagination";
import AdCampaignPreview from "@components/ad-campaign/ad-campaign-preview";
import AdCampaignTabSwitcher from "@components/ad-campaign/ad-campaign-tab-switcher";
import type { AdPreviewType, CampaignProps } from "@components/ad-campaign/ad-campaign.types";
import LogoSpinner from "@components/ui/logo-spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePage } from "@inertiajs/react";
import { LanggraphProvider } from "@contexts/langgraph-context";
import { useEffect, useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { Ads, type UUIDType } from "@shared";
import CampaignInner from "./CampaignInner";

const TABS = [
  { id: "content", label: "Content" },
  { id: "highlights", label: "Highlights" },
];

export default function Campaign() {
  return (
    <LanggraphProvider>
      <CampaignInner tabs={TABS} />
    </LanggraphProvider>
  );
}
