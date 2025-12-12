import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@components/ui/field";
import AdCampaignFieldList from "@components/ads/ad-campaign-form/ad-campaign-field-list";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads, keyBy } from "@shared";
import { Info, Sparkles } from "lucide-react";

const descriptionsFormSchema = z.object({
  descriptions: z.array(Ads.AssetSchema),
});

type DescriptionsFormData = z.infer<typeof descriptionsFormSchema>;

export default function DescriptionsForm() {
  const descriptions = useAdsChatState("descriptions");
  const { setState, updateState } = useAdsChatActions();

  const methods = useForm<DescriptionsFormData>({
    resolver: zodResolver(descriptionsFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      descriptions: [],
    },
  });

  const { fields } = useFieldArray({
    control: methods.control,
    name: "descriptions",
  });

  useEffect(() => {
    if (descriptions?.length) {
      const filtered = descriptions.filter((d) => !d.rejected);
      methods.setValue("descriptions", filtered);
    }
  }, [descriptions, methods]);

  // Attach our methods to the parent "content" form
  // This allows other parts of our codebase (e.g. Footer)
  // to simply call validate on all "content" pieces
  useFormRegistration("content", methods);

  const handleLockToggle = (
    fieldName: "headlines" | "descriptions" | "features" | "callouts",
    index: number
  ) => {
    if (fieldName !== "descriptions") return;

    const currentFields = methods.getValues("descriptions");
    const isLocked = currentFields[index].locked;

    if (!isLocked && !currentFields[index].text) {
      methods.setError(`descriptions.${index}.text`, {
        type: "manual",
        message: "Cannot lock an empty input.",
      });
      return;
    }

    const updatedFields = currentFields.map((field, i) =>
      i === index ? { ...field, locked: !isLocked } : field
    );
    methods.setValue("descriptions", updatedFields);

    const updatedLanggraph = descriptions?.map((d, i) =>
      i === index ? { ...d, locked: !isLocked } : d
    );
    setState({ descriptions: updatedLanggraph });
  };

  const handleRefreshDescriptions = () => {
    const lockedDescriptions = descriptions?.filter((d) => d.locked) || [];
    const lockedByText = keyBy(lockedDescriptions, "text");
    const numLocked = lockedDescriptions.length;

    const updatedDescriptions = descriptions?.map((d) => ({
      ...d,
      locked: !!lockedByText[d.text],
      rejected: !lockedByText[d.text],
    }));

    updateState({
      refresh: {
        asset: "descriptions",
        nVariants: Ads.DefaultNumAssets["descriptions"] - numLocked,
      },
      descriptions: updatedDescriptions,
    });
  };

  return (
    <FieldGroup>
      <Field>
        <FieldLabel className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Descriptions</span>
            <Info size={12} className="text-base-300" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Select 2-4</Badge>
            <Button
              type="button"
              variant="link"
              className="text-base-400 font-normal"
              onClick={handleRefreshDescriptions}
            >
              <Sparkles /> Refresh Suggestions
            </Button>
          </div>
        </FieldLabel>
      </Field>
      <AdCampaignFieldList
        fieldName="descriptions"
        fields={fields}
        onLockToggle={handleLockToggle}
        control={methods.control as any}
        placeholder="Description Option"
        maxLength={90}
      />
    </FieldGroup>
  );
}
