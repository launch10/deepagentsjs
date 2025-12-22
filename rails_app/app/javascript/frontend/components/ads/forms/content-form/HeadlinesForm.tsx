import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useRef } from "react";
import { FieldGroup } from "@components/ui/field";
import AdCampaignHeadlineInput from "./AdCampaignHeadlineInput";
import AdCampaignFieldList from "../shared/AdCampaignFieldList";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import { Ads, generateUUID } from "@shared";
import { createRefreshHandler } from "../../utils/refreshAssets";
import { useAutosaveCampaign } from "@api/campaigns.hooks";
import { defaultAssetTransform } from "@hooks/campaignAutosave.transforms";
import type { UpdateCampaignRequestBody } from "@api/campaigns";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { createLockToggleHandler } from "@helpers/handleLockToggle";

const headlinesFormSchema = z.object({
  headlines: z
    .array(Ads.AssetSchema)
    .min(3, "At least 3 headlines required")
    .max(15, "Maximum 15 headlines allowed"),
});

type HeadlinesFormData = z.infer<typeof headlinesFormSchema>;

export default function HeadlinesForm() {
  const headlines = useAdsChatState("headlines");
  const { setState, updateState } = useAdsChatActions();

  const filteredHeadlines = (headlines || []).filter((h) => !h.rejected);
  const prevIdsRef = useRef<string[]>([]);

  const methods = useForm<HeadlinesFormData>({
    resolver: zodResolver(headlinesFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      headlines: filteredHeadlines,
    },
  });

  useEffect(() => {
    const currentIds = filteredHeadlines.map((h) => h.id).join(",");
    const prevIds = prevIdsRef.current.join(",");

    if (currentIds !== prevIds) {
      methods.reset({ headlines: filteredHeadlines });
      prevIdsRef.current = filteredHeadlines.map((h) => h.id);
    }
  }, [filteredHeadlines, methods]);

  const handleAddHeadline = (value: string) => {
    const newHeadline: Ads.Headline = {
      id: generateUUID(),
      text: value,
      locked: false,
      rejected: false,
    };
    setState({ headlines: [...(headlines || []), newHeadline] });
  };

  const handleDeleteHeadline = (index: number) => {
    const headlineId = filteredHeadlines[index]?.id;
    if (!headlineId) return;
    setState({ headlines: headlines?.filter((h) => h.id !== headlineId) });
  };

  const handleLockToggle = createLockToggleHandler(
    "headlines",
    methods,
    () => filteredHeadlines,
    () => headlines,
    setState
  );

  const handleRefreshHeadlines = () => {
    createRefreshHandler("headlines", headlines, updateState);
  };

  const handleInputChange = (index: number, input: string) => {
    const headlineId = filteredHeadlines[index]?.id;
    if (!headlineId) return;
    setState({
      headlines: headlines?.map((h) => (h.id === headlineId ? { ...h, text: input } : h)),
    });
  };

  const { saveNow } = useAutosaveCampaign<HeadlinesFormData>({
    methods,
    transformFn: (data): Partial<UpdateCampaignRequestBody> | null => {
      const transformed = defaultAssetTransform(data.headlines);
      if (transformed.length === 0) return null;
      return { headlines: transformed };
    },
  });

  const fields = filteredHeadlines.map((h) => ({ ...h, id: h.id }));

  useFormRegistration("content", methods, saveNow);

  return (
    <FieldGroup className="gap-3">
      <AdCampaignHeadlineInput
        onAdd={handleAddHeadline}
        currentCount={fields.length}
        maxCount={15}
        error={methods.formState.errors.headlines?.message}
        onRefreshSuggestions={handleRefreshHeadlines}
      />
      <AdCampaignFieldList
        fieldName="headlines"
        fields={fields as any}
        onLockToggle={handleLockToggle}
        onDelete={handleDeleteHeadline}
        control={methods.control as any}
        placeholder="Headline Option"
        maxLength={30}
        onInputChange={handleInputChange}
      />
    </FieldGroup>
  );
}
