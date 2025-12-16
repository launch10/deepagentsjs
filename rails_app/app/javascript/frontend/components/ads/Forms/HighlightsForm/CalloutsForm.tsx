import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { Badge } from "@components/ui/badge";
import { Field, FieldGroup } from "@components/ui/field";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAdsChatActions, useAdsChatState } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads } from "@shared";
import { Info } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { createRefreshHandler } from "../../utils/refreshAssets";
import RefreshSuggestionsButton from "../shared/RefreshSuggestionsButton";
import { createLockToggleHandler } from "@helpers/handleLockToggle";
import { useCampaignAutosave } from "@hooks/useCampaignAutosave";

const calloutsFormSchema = z.object({
  callouts: z.array(Ads.AssetSchema),
});

type CalloutsFormData = z.infer<typeof calloutsFormSchema>;

export default function CalloutsForm() {
  const callouts = useAdsChatState("callouts");
  const { setState, updateState } = useAdsChatActions();

  const methods = useForm<CalloutsFormData>({
    resolver: zodResolver(calloutsFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      callouts: [],
    },
  });

  const { fields, remove } = useFieldArray({
    control: methods.control,
    name: "callouts",
  });

  useEffect(() => {
    if (callouts?.length) {
      const filtered = callouts.filter((c) => !c.rejected);
      methods.setValue("callouts", filtered);
    }
  }, [callouts, methods]);

  useFormRegistration("highlights", methods);

  const handleLockToggle = createLockToggleHandler(methods, "callouts", () => callouts, setState);

  const handleRefreshCallouts = () => {
    createRefreshHandler("callouts", callouts, updateState);
  };

  const handleDeleteCallout = (index: number) => {
    remove(index);
    const updatedLanggraph = callouts?.filter((c, i) => i !== index);
    setState({ callouts: updatedLanggraph });
  };

  useCampaignAutosave({
    methods,
    fieldMappings: [{ formField: "callouts", apiField: "callouts" }],
  });

  return (
    <FieldGroup className="gap-2">
      <Field>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Unique Features</span>
            <Info size={12} className="text-base-300" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Select 2-10</Badge>
            <RefreshSuggestionsButton onClick={handleRefreshCallouts} />
          </div>
        </div>
      </Field>
      <AdCampaignFieldList
        fieldName="callouts"
        fields={fields}
        onLockToggle={handleLockToggle}
        onDelete={handleDeleteCallout}
        control={methods.control as any} // TODO: Fix this
        placeholder="Feature Option"
        maxLength={25}
      />
    </FieldGroup>
  );
}
