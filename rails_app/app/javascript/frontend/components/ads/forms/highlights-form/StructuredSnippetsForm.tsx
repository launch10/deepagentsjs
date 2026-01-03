import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@components/ui/field";
import { useAdsChatActions, useAdsChatState } from "@components/ads/hooks";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads, generateUUID, keyBy } from "@shared";
import { Info, Plus } from "lucide-react";
import RefreshSuggestionsButton from "../shared/RefreshSuggestionsButton";
import { createLockToggleHandler } from "@helpers/handleLockToggle";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { useAutosaveCampaign } from "@api/campaigns.hooks";
import type { UpdateCampaignRequestBody } from "@rails_api_base";

const STRUCTURED_SNIPPET_CATEGORIES = Ads.StructuredSnippetCategoryKeys.map((key) => ({
  value: key, // Backend expects keys like "services", not display names like "Service catalog"
  label: Ads.StructuredSnippetCategories[key].key, // Display names for UI
}));

export default function StructuredSnippetsForm() {
  const structuredSnippets = useAdsChatState("structuredSnippets");
  const { setState, updateState } = useAdsChatActions();

  const category = structuredSnippets?.category;
  const details = structuredSnippets?.details;
  const filteredDetails = (details || []).filter((d) => !d.rejected);
  const prevIdsRef = useRef<string[]>([]);

  const methods = useForm<Ads.StructuredSnippetsOutput>({
    resolver: zodResolver(Ads.StructuredSnippetsOutputSchema) as any,
    mode: "onChange",
    defaultValues: {
      category: category,
      details: filteredDetails,
    },
  });

  useEffect(() => {
    const currentIds = filteredDetails.map((d) => d.id).join(",");
    const prevIds = prevIdsRef.current.join(",");

    if (currentIds !== prevIds) {
      methods.reset({ category, details: filteredDetails });
      prevIdsRef.current = filteredDetails.map((d) => d.id);
    }
  }, [filteredDetails, category, methods]);

  useEffect(() => {
    if (category && methods.getValues("category") !== category) {
      methods.setValue("category", category as Ads.StructuredSnippetCategoryKey);
    }
  }, [category, methods]);

  const handleCategoryChange = (value: string) => {
    methods.setValue("category", value as Ads.StructuredSnippetCategoryKey);
    setState({
      structuredSnippets: {
        ...structuredSnippets,
        category: value as Ads.StructuredSnippetCategoryKey,
        details: structuredSnippets?.details || [],
      },
    });
  };

  const handleLockToggle = createLockToggleHandler(
    "details",
    methods,
    () => filteredDetails,
    () => details,
    (updates) => {
      setState({
        structuredSnippets: {
          ...structuredSnippets,
          category: structuredSnippets?.category as Ads.StructuredSnippetCategoryKey,
          details: updates.details || [],
        },
      });
    }
  );

  const handleAddDetail = () => {
    const newDetail = { id: generateUUID(), text: "", locked: false, rejected: false };
    setState({
      structuredSnippets: {
        ...structuredSnippets,
        category: structuredSnippets?.category as Ads.StructuredSnippetCategoryKey,
        details: [...(details || []), newDetail],
      },
    });
  };

  const handleDeleteDetail = (index: number) => {
    const detailId = filteredDetails[index]?.id;
    if (!detailId) return;
    setState({
      structuredSnippets: {
        ...structuredSnippets,
        category: structuredSnippets?.category as Ads.StructuredSnippetCategoryKey,
        details: details?.filter((d) => d.id !== detailId) || [],
      },
    });
  };

  const handleInputChange = (index: number, input: string) => {
    const detailId = filteredDetails[index]?.id;
    if (!detailId) return;
    setState({
      structuredSnippets: {
        ...structuredSnippets,
        category: structuredSnippets?.category as Ads.StructuredSnippetCategoryKey,
        details: details?.map((d) => (d.id === detailId ? { ...d, text: input } : d)) || [],
      },
    });
  };

  const handleRefreshSnippets = () => {
    const currentDetails = structuredSnippets?.details || [];
    const lockedDetails = currentDetails.filter((d) => d.locked);
    const lockedByText = keyBy(lockedDetails, "text");
    const numLocked = lockedDetails.length;

    const updatedDetails = currentDetails.map((d) => ({
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
        category: structuredSnippets?.category as Ads.StructuredSnippetCategoryKey,
        details: updatedDetails,
      },
    });
  };

  const { getData } = useAutosaveCampaign<Ads.StructuredSnippetsOutput>({
    methods,
    formId: "structured-snippets",
    transformFn: (data): Partial<UpdateCampaignRequestBody> | null => {
      const values = data.details?.filter((d) => d.text?.trim()).map((d) => d.text) ?? [];

      if (!data.category || values.length === 0) return null;

      return {
        structured_snippet: {
          category: data.category,
          values,
        },
      };
    },
  });

  useFormRegistration("highlights", methods, getData);

  const fields = filteredDetails.map((d) => ({ ...d, id: d.id }));

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
            <Select
              value={methods.watch("category") || undefined}
              onValueChange={(value) => handleCategoryChange(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STRUCTURED_SNIPPET_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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
            onInputChange={handleInputChange}
          />
        </FieldGroup>
        <Button type="button" variant="ghost" size="sm" onClick={handleAddDetail}>
          <Plus /> Add Value
        </Button>
      </div>
    </div>
  );
}
