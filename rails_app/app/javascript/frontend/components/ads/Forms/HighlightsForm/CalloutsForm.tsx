import AdCampaignFieldList from "@components/ads/Forms/shared/AdCampaignFieldList";
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

  const { fields } = useFieldArray({
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

  const handleLockToggle = (
    _fieldName: "headlines" | "descriptions" | "features" | "callouts" | "details" | "keywords",
    index: number
  ) => {
    const currentFields = methods.getValues("callouts");
    const isLocked = currentFields[index].locked;

    if (!isLocked && !currentFields[index].text) {
      methods.setError(`callouts.${index}.text`, {
        type: "manual",
        message: "Cannot lock an empty input.",
      });
      return;
    }

    const updatedFields = currentFields.map((field, i) =>
      i === index ? { ...field, locked: !isLocked } : field
    );
    methods.setValue("callouts", updatedFields);

    const updatedLanggraph = callouts?.map((c, i) =>
      i === index ? { ...c, locked: !isLocked } : c
    );
    setState({ callouts: updatedLanggraph });
  };

  const handleRefreshCallouts = () => {
    createRefreshHandler("callouts", callouts, updateState);
  };

  const handleDeleteCallout = (index: number) => {
    const currentFields = methods.getValues("callouts");
    const updatedFields = currentFields.filter((_, i) => i !== index);
    methods.setValue("callouts", updatedFields);

    const updatedLanggraph = callouts?.filter((c, i) => i !== index);
    setState({ callouts: updatedLanggraph });
  };

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
        maxLength={90}
      />
    </FieldGroup>
  );
}
