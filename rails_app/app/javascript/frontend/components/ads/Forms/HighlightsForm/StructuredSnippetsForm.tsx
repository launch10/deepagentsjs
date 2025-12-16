import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@components/ui/field";
import { NativeSelect } from "@components/ui/native-select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAdsChatActions, useAdsChatState } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads, generateUUID, keyBy } from "@shared";
import { Info, Plus } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import RefreshSuggestionsButton from "../shared/RefreshSuggestionsButton";
import { createLockToggleHandler } from "@helpers/handleLockToggle";
import { useCampaignAutosave } from "@hooks/useCampaignAutosave";

const STRUCTURED_SNIPPET_CATEGORIES = Ads.StructuredSnippetCategoryKeys.map((key) => ({
  value: Ads.StructuredSnippetCategories[key].key,
  label: Ads.StructuredSnippetCategories[key].key,
}));

const structuredSnippetsFormSchema = z.object({
  category: z.string(),
  details: z.array(Ads.AssetSchema),
});

type StructuredSnippetsFormData = z.infer<typeof structuredSnippetsFormSchema>;

export default function StructuredSnippetsForm() {
  const structuredSnippets = useAdsChatState("structuredSnippets");
  const { setState, updateState } = useAdsChatActions();

  const methods = useForm<StructuredSnippetsFormData>({
    resolver: zodResolver(structuredSnippetsFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      category: "",
      details: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: "details",
  });

  const category = structuredSnippets?.category;
  const details = structuredSnippets?.details;

  useEffect(() => {
    if (category) {
      methods.setValue("category", category);
    }
  }, [category]);

  useEffect(() => {
    if (details?.length) {
      const filtered = details.filter((d) => !d.rejected);
      methods.setValue("details", filtered);
    }
  }, [details]);

  useFormRegistration("highlights", methods);

  const handleCategoryChange = (value: string) => {
    methods.setValue("category", value);
    setState({
      structuredSnippets: {
        ...structuredSnippets,
        category: value,
        details: structuredSnippets?.details || [],
      },
    });
  };

  const handleLockToggle = createLockToggleHandler(methods, "details", () => details, setState);

  const handleAddDetail = () => {
    const newDetail = { id: generateUUID(), text: "", locked: false, rejected: false };
    append(newDetail);
  };

  const handleDeleteDetail = (index: number) => {
    remove(index);
  };

  const handleRefreshSnippets = () => {
    const details = structuredSnippets?.details || [];
    const lockedDetails = details.filter((d) => d.locked);
    const lockedByText = keyBy(lockedDetails, "text");
    const numLocked = lockedDetails.length;

    const updatedDetails = details.map((d) => ({
      ...d,
      locked: !!lockedByText[d.text],
      rejected: !lockedByText[d.text],
    }));

    updateState({
      refresh: [
        {
          asset: "structuredSnippets",
          nVariants: Ads.DefaultNumAssets.structuredSnippets - numLocked,
        },
      ],
      structuredSnippets: {
        ...structuredSnippets,
        category: structuredSnippets?.category || "",
        details: updatedDetails,
      },
    });
  };

  useCampaignAutosave({
    methods,
    fieldMappings: [{ formField: "details", apiField: "details" }],
  });

  return (
    <div className="grid grid-cols-2">
      <div className="col-span-1">
        <FieldGroup className="gap-2">
          <div className="flex items-center gap-2 mb-6">
            <span className="font-semibold text-sm">Product or Service Offerings</span>
            <Info size={12} className="text-base-300" />
          </div>
          <Field>
            <FieldLabel className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-base-400">Category</span>
                <Info size={12} className="text-base-300" />
              </div>
            </FieldLabel>
            <NativeSelect
              value={methods.watch("category")}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="" disabled selected>
                Select a category
              </option>
              {STRUCTURED_SNIPPET_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-xs text-base-400">Details</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Select 3-10</Badge>
                <RefreshSuggestionsButton onClick={handleRefreshSnippets} />
              </div>
            </div>
          </Field>
          <AdCampaignFieldList
            fieldName="details"
            fields={fields as any}
            control={methods.control as any}
            placeholder="Detail value"
            maxLength={25}
            onLockToggle={handleLockToggle}
            onDelete={handleDeleteDetail}
          />
        </FieldGroup>
        <Button type="button" variant="ghost" size="sm" onClick={handleAddDetail}>
          <Plus /> Add Value
        </Button>
      </div>
    </div>
  );
}
