import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FieldGroup } from "@components/ui/field";
import AdCampaignHeadlineInput from "@components/ads/forms/ContentForm/AdCampaignHeadlineInput";
import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads, generateUUID } from "@shared";
import { createRefreshHandler } from "../../utils/refreshAssets";

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

  const methods = useForm<HeadlinesFormData>({
    resolver: zodResolver(headlinesFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      headlines: [],
    },
  });

  const { fields, append } = useFieldArray({
    control: methods.control,
    name: "headlines",
  });

  useEffect(() => {
    if (headlines?.length) {
      const filtered = headlines.filter((h) => !h.rejected);
      methods.setValue("headlines", filtered);
    }
  }, [headlines, methods]);

  useFormRegistration("content", methods);

  const handleAddHeadline = (value: string) => {
    const newHeadline: Ads.Headline = {
      id: generateUUID(),
      text: value,
      locked: false,
      rejected: false,
    };
    append(newHeadline);

    const updated = [...(headlines || []), newHeadline];
    setState({ headlines: updated });
  };

  const handleLockToggle = (
    fieldName: "headlines" | "descriptions" | "features" | "callouts",
    index: number
  ) => {
    if (fieldName !== "headlines") return;

    const currentFields = methods.getValues("headlines");
    const isLocked = currentFields[index].locked;

    if (!isLocked && !currentFields[index].text) {
      methods.setError(`headlines.${index}.text`, {
        type: "manual",
        message: "Cannot lock an empty input.",
      });
      return;
    }

    const updatedFields = currentFields.map((field, i) =>
      i === index ? { ...field, locked: !isLocked } : field
    );
    methods.setValue("headlines", updatedFields);

    const updatedLanggraph = headlines?.map((h, i) =>
      i === index ? { ...h, locked: !isLocked } : h
    );
    setState({ headlines: updatedLanggraph });
  };

  const handleRefreshHeadlines = () => {
    createRefreshHandler("headlines", headlines, updateState);
  };

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
        fields={fields}
        onLockToggle={handleLockToggle}
        // onDelete={handleDeleteHeadline}
        control={methods.control as any}
        placeholder="Headline Option"
        maxLength={30}
      />
    </FieldGroup>
  );
}
