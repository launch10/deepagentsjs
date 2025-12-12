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
    _fieldName: "headlines" | "descriptions" | "features" | "callouts",
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
    const lockedCallouts = callouts?.filter((c) => c.locked) || [];
    const lockedByText = keyBy(lockedCallouts, "text");
    const numLocked = lockedCallouts.length;

    const updatedCallouts = callouts?.map((c) => ({
      ...c,
      locked: !!lockedByText[c.text],
      rejected: !lockedByText[c.text],
    }));

    updateState({
      refresh: {
        asset: "callouts",
        nVariants: Ads.DefaultNumAssets["callouts"] - numLocked,
      },
      callouts: updatedCallouts,
    });
  };

  return (
    <FieldGroup className="gap-2">
      <Field>
        <FieldLabel className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Unique Features</span>
            <Info size={12} className="text-base-300" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Select 2-10</Badge>
            <Button
              type="button"
              variant="link"
              className="text-base-400 font-normal"
              onClick={handleRefreshCallouts}
            >
              <Sparkles /> Refresh Suggestions
            </Button>
          </div>
        </FieldLabel>
      </Field>
      <AdCampaignFieldList
        fieldName="callouts"
        fields={fields}
        onLockToggle={handleLockToggle}
        control={methods.control as any}
        placeholder="Feature Option"
        maxLength={90}
      />
    </FieldGroup>
  );
}
