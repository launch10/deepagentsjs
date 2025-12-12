import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FieldGroup } from "@components/ui/field";
import AdCampaignHeadlineInput from "@components/ads/ad-campaign-form/ad-campaign-headline-input";
import AdCampaignFieldList from "@components/ads/ad-campaign-form/ad-campaign-field-list";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { useFormRegistry, selectSetFocusedParent } from "@stores/formRegistry";
import { Ads, generateUUID } from "@shared";

const headlinesFormSchema = z.object({
  headlines: z
    .array(Ads.AssetSchema)
    .min(3, "At least 3 headlines required")
    .max(15, "Maximum 15 headlines allowed"),
});

type HeadlinesFormData = z.infer<typeof headlinesFormSchema>;

interface HeadlinesFormProps {
  onRefreshSuggestions: () => void;
}

export default function HeadlinesForm({ onRefreshSuggestions }: HeadlinesFormProps) {
  const headlines = useAdsChatState("headlines");
  const { setState } = useAdsChatActions();
  const setFocusedParent = useFormRegistry(selectSetFocusedParent);

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

  useFormRegistration("content", methods, "headlines.0.text");

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
    fieldName: "headlines" | "descriptions" | "features",
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

  return (
    <FieldGroup onFocus={() => setFocusedParent("content")}>
      <AdCampaignHeadlineInput
        onAdd={handleAddHeadline}
        currentCount={fields.length}
        maxCount={15}
        error={methods.formState.errors.headlines?.message}
        onRefreshSuggestions={onRefreshSuggestions}
      />
      <AdCampaignFieldList
        fieldName="headlines"
        fields={fields}
        onLockToggle={handleLockToggle}
        control={methods.control as any}
        placeholder="Headline Option"
        maxLength={30}
      />
    </FieldGroup>
  );
}
