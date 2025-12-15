import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads, keyBy } from "@shared";
import { Info, Sparkles } from "lucide-react";

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

  const { fields } = useFieldArray({
    control: methods.control,
    name: "details",
  });

  useEffect(() => {
    if (structuredSnippets) {
      methods.setValue("category", structuredSnippets.category || "");
      const filtered = structuredSnippets.details?.filter((d) => !d.rejected) || [];
      methods.setValue("details", filtered);
    }
  }, [structuredSnippets]);

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

  const handleLockToggle = (_fieldName: string, index: number) => {
    const currentFields = methods.getValues("details");
    const isLocked = currentFields[index].locked;

    if (!isLocked && !currentFields[index].text) {
      methods.setError(`details.${index}.text`, {
        type: "manual",
        message: "Cannot lock an empty input.",
      });
      return;
    }

    const updatedFields = currentFields.map((field, i) =>
      i === index ? { ...field, locked: !isLocked } : field
    );
    methods.setValue("details", updatedFields);

    const updatedDetails = structuredSnippets?.details?.map((d, i) =>
      i === index ? { ...d, locked: !isLocked } : d
    );
    setState({
      structuredSnippets: {
        ...structuredSnippets,
        category: structuredSnippets?.category || "",
        details: updatedDetails || [],
      },
    });
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
      refresh: [{ asset: "structuredSnippets", nVariants: Ads.DefaultNumAssets.structuredSnippets - numLocked }],
      structuredSnippets: {
        ...structuredSnippets,
        category: structuredSnippets?.category || "",
        details: updatedDetails,
      },
    });
  };

  return (
    <FieldGroup className="gap-2">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Product or Service Offerings</span>
        <Info size={12} className="text-base-300" />
      </div>
      <Field>
        <FieldLabel className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-base-400">Category</span>
            <Info size={12} className="text-base-300" />
          </div>
        </FieldLabel>
        <Select
          value={methods.watch("category")}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {STRUCTURED_SNIPPET_CATEGORIES.map((category) => (
              <SelectItem key={category.value} value={category.label}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel className="flex justify-between items-center">
          <span className="font-semibold text-xs text-base-400">Details</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Select 3-10</Badge>
            <Button
              type="button"
              variant="link"
              className="text-base-400 font-normal"
              onClick={handleRefreshSnippets}
            >
              <Sparkles /> Refresh Suggestions
            </Button>
          </div>
        </FieldLabel>
      </Field>
      <AdCampaignFieldList
        fieldName="details"
        fields={fields as any}
        onLockToggle={handleLockToggle}
        control={methods.control as any}
        placeholder="Detail value"
        maxLength={25}
      />
    </FieldGroup>
  );
}
