import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@components/ui/badge";
import { Field, FieldGroup } from "@components/ui/field";
import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { useAdsChatState, useAdsChatActions, useAutosaveCampaign, defaultAssetTransform } from "@components/ads/hooks";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads } from "@shared";
import { createRefreshHandler } from "../../utils/refreshAssets";
import { Info } from "lucide-react";
import { createLockToggleHandler } from "@helpers/handleLockToggle";
import type { UpdateCampaignRequestBody } from "@rails_api_base";
import RefreshSuggestionsButton from "../shared/RefreshSuggestionsButton";

export default function DescriptionsForm() {
  const descriptions = useAdsChatState("descriptions");
  const { setState, updateState } = useAdsChatActions();

  const filteredDescriptions = (descriptions || []).filter((d) => !d.rejected);
  const prevIdsRef = useRef<string[]>([]);

  const methods = useForm<Ads.DescriptionsOutput>({
    resolver: zodResolver(Ads.DescriptionsOutputSchema) as any,
    mode: "onChange",
    defaultValues: {
      descriptions: filteredDescriptions,
    },
  });

  useEffect(() => {
    const currentIds = filteredDescriptions.map((d) => d.id).join(",");
    const prevIds = prevIdsRef.current.join(",");

    if (currentIds !== prevIds) {
      methods.reset({ descriptions: filteredDescriptions });
      prevIdsRef.current = filteredDescriptions.map((d) => d.id);
    }
  }, [filteredDescriptions, methods]);

  const handleLockToggle = createLockToggleHandler(
    "descriptions",
    methods,
    () => filteredDescriptions,
    () => descriptions,
    setState
  );

  const handleRefreshDescriptions = () => {
    createRefreshHandler("descriptions", descriptions, updateState);
  };

  const handleDeleteDescription = (index: number) => {
    const descId = filteredDescriptions[index]?.id;
    if (!descId) return;
    setState({ descriptions: descriptions?.filter((d) => d.id !== descId) });
  };

  const handleInputChange = (index: number, input: string) => {
    const descId = filteredDescriptions[index]?.id;
    if (!descId) return;
    setState({
      descriptions: descriptions?.map((d) => (d.id === descId ? { ...d, text: input } : d)),
    });
  };

  const { getData } = useAutosaveCampaign<Ads.DescriptionsOutput>({
    methods,
    formId: "descriptions",
    transformFn: (data): Partial<UpdateCampaignRequestBody> | null => {
      const transformed = defaultAssetTransform(data.descriptions);
      if (transformed.length === 0) return null;
      return { descriptions: transformed };
    },
  });

  useFormRegistration("content", methods, getData);

  const fields = filteredDescriptions.map((d) => ({ ...d, id: d.id }));

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
        fields={fields as any}
        onLockToggle={handleLockToggle}
        onDelete={handleDeleteDescription}
        control={methods.control as any}
        placeholder="Description Option"
        maxLength={90}
        onInputChange={handleInputChange}
      />
    </FieldGroup>
  );
}
