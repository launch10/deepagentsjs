import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@components/ui/badge";
import { Field, FieldGroup } from "@components/ui/field";
import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads } from "@shared";
import { createRefreshHandler } from "../../utils/refreshAssets";
import { Info } from "lucide-react";
import { createLockToggleHandler } from "@helpers/handleLockToggle";
import { useCampaignAutosave } from "@hooks/useCampaignAutosave";
import RefreshSuggestionsButton from "../shared/RefreshSuggestionsButton";

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

  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: "descriptions",
  });

  useEffect(() => {
    if (descriptions?.length) {
      const filtered = descriptions.filter((d) => !d.rejected);
      methods.setValue("descriptions", filtered);
    }
  }, [descriptions, methods]);

  const handleLockToggle = createLockToggleHandler(
    methods,
    "descriptions",
    () => descriptions,
    setState
  );

  const handleRefreshDescriptions = () => {
    createRefreshHandler("descriptions", descriptions, updateState);
  };

  const handleDeleteDescription = (index: number) => {
    remove(index);
    const updatedLanggraph = descriptions?.filter((d, i) => i !== index);
    setState({ descriptions: updatedLanggraph });
  };

  const { save } = useCampaignAutosave({
    methods,
    fieldMappings: [{ formField: "descriptions", apiField: "descriptions" }],
    values: [descriptions],
  });

  // Attach save function to form registration
  useFormRegistration("content", methods, save);

  return (
    <FieldGroup className="gap-3">
      <Field>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Details</span>
            <Info size={12} className="text-base-300" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Select 2-4</Badge>
            <RefreshSuggestionsButton onClick={handleRefreshDescriptions} />
          </div>
        </div>
      </Field>
      <AdCampaignFieldList
        fieldName="descriptions"
        fields={fields}
        onLockToggle={handleLockToggle}
        onDelete={handleDeleteDescription}
        control={methods.control as any}
        placeholder="Description Option"
        maxLength={90}
      />
    </FieldGroup>
  );
}
