import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { Badge } from "@components/ui/badge";
import { Field, FieldGroup } from "@components/ui/field";
import { useAdsChatActions, useAdsChatState } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads } from "@shared";
import { Info } from "lucide-react";
import { createRefreshHandler } from "../../utils/refreshAssets";
import RefreshSuggestionsButton from "../shared/RefreshSuggestionsButton";
import { createLockToggleHandler } from "@helpers/handleLockToggle";
import { useAutosaveCampaign } from "@api/campaigns.hooks";
import { defaultAssetTransform } from "@hooks/campaignAutosave.transforms";
import type { UpdateCampaignRequestBody } from "@api/campaigns";

const calloutsFormSchema = z.object({
  callouts: z.array(Ads.AssetSchema),
});

type CalloutsFormData = z.infer<typeof calloutsFormSchema>;

export default function CalloutsForm() {
  const callouts = useAdsChatState("callouts");
  const { setState, updateState } = useAdsChatActions();

  const filteredCallouts = (callouts || []).filter((c) => !c.rejected);
  const prevIdsRef = useRef<string[]>([]);

  const methods = useForm<CalloutsFormData>({
    resolver: zodResolver(calloutsFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      callouts: filteredCallouts,
    },
  });

  useEffect(() => {
    const currentIds = filteredCallouts.map((c) => c.id).join(",");
    const prevIds = prevIdsRef.current.join(",");

    if (currentIds !== prevIds) {
      methods.reset({ callouts: filteredCallouts });
      prevIdsRef.current = filteredCallouts.map((c) => c.id);
    }
  }, [filteredCallouts, methods]);

  const handleLockToggle = createLockToggleHandler(
    "callouts",
    methods,
    () => filteredCallouts,
    () => callouts,
    setState
  );

  const handleRefreshCallouts = () => {
    createRefreshHandler("callouts", callouts, updateState);
  };

  const handleDeleteCallout = (index: number) => {
    const calloutId = filteredCallouts[index]?.id;
    if (!calloutId) return;
    setState({ callouts: callouts?.filter((c) => c.id !== calloutId) });
  };

  const handleInputChange = (index: number, input: string) => {
    const calloutId = filteredCallouts[index]?.id;
    if (!calloutId) return;
    setState({
      callouts: callouts?.map((c) => (c.id === calloutId ? { ...c, text: input } : c)),
    });
  };

  const { saveNow } = useAutosaveCampaign<CalloutsFormData>({
    methods,
    transformFn: (data): Partial<UpdateCampaignRequestBody> | null => {
      const transformed = defaultAssetTransform(data.callouts);
      if (transformed.length === 0) return null;
      return { callouts: transformed };
    },
  });

  useFormRegistration("highlights", methods, saveNow);

  const fields = filteredCallouts.map((c) => ({ ...c, id: c.id }));

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
        fields={fields as any}
        onLockToggle={handleLockToggle}
        onDelete={handleDeleteCallout}
        control={methods.control as any}
        placeholder="Feature Option"
        maxLength={25}
        onInputChange={handleInputChange}
      />
    </FieldGroup>
  );
}
