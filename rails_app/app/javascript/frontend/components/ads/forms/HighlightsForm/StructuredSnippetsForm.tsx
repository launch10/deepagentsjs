import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@components/ui/field";
import { useAdsChatActions, useAdsChatState } from "@hooks/useAdsChat";
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
import { mapApiErrorsToForm } from "@helpers/formErrorMapper";
import { useDebounce } from "@hooks/useDebounce";

const STRUCTURED_SNIPPET_CATEGORIES = Ads.StructuredSnippetCategoryKeys.map((key) => ({
  value: key,
  label: Ads.StructuredSnippetCategories[key].key,
}));

const displayNameToKey = Object.fromEntries(
  Ads.StructuredSnippetCategoryKeys.map((key) => [Ads.StructuredSnippetCategories[key].key, key])
);

const normalizeCategory = (category: string | undefined): string => {
  if (!category) return "";
  if (Ads.StructuredSnippetCategoryKeys.includes(category as any)) {
    return category;
  }
  return displayNameToKey[category] || category;
};

const structuredSnippetsFormSchema = z.object({
  category: z.string(),
  details: z.array(Ads.AssetSchema),
});

type StructuredSnippetsFormData = z.infer<typeof structuredSnippetsFormSchema>;

export default function StructuredSnippetsForm() {
  const structuredSnippets = useAdsChatState("structuredSnippets");
  const { setState, updateState } = useAdsChatActions();

  const category = normalizeCategory(structuredSnippets?.category);
  const details = structuredSnippets?.details;
  const filteredDetails = (details || []).filter((d) => !d.rejected);
  const prevIdsRef = useRef<string[]>([]);

  const methods = useForm<StructuredSnippetsFormData>({
    resolver: zodResolver(structuredSnippetsFormSchema) as any,
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
      methods.setValue("category", category);
    }
  }, [category, methods]);

  const handleCategoryChange = (value: string) => {
    methods.setValue("category", value);
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

  const campaignId = useAdsChatState("campaignId");
  const autosaveMutation = useAutosaveCampaign(campaignId);

  const save = async () => {
    if (!campaignId) return;

    const currentCategory = methods.getValues("category");
    const currentDetails = methods.getValues("details");
    const values =
      currentDetails
        ?.filter((d: { text?: string }) => d.text?.trim())
        .map((d: { text: string }) => d.text) ?? [];

    if (!currentCategory || values.length === 0) return;

    return new Promise<void>((resolve, reject) => {
      autosaveMutation.mutate(
        {
          campaign: {
            structured_snippet: {
              category: currentCategory,
              values,
            },
          },
        },
        {
          onSuccess: () => resolve(),
          onError: (error) => {
            mapApiErrorsToForm(error, methods);
            reject(error);
          },
        }
      );
    });
  };

  const debouncedCategory = useDebounce(category, 750);
  const debouncedDetails = useDebounce(details, 750);
  const isInitialMount = useRef(true);
  const lastSavedValue = useRef<string | null>(null);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!campaignId || autosaveMutation.isPending) return;

    const values =
      debouncedDetails
        ?.filter((d: { text?: string; rejected?: boolean }) => d.text?.trim() && !d.rejected)
        .map((d: { text: string }) => d.text) ?? [];

    if (!debouncedCategory || values.length === 0) return;

    const serialized = JSON.stringify({ category: debouncedCategory, values });
    if (serialized === lastSavedValue.current) return;
    lastSavedValue.current = serialized;

    autosaveMutation.mutate(
      {
        campaign: {
          structured_snippet: {
            category: debouncedCategory,
            values,
          },
        },
      },
      {
        onError: (error) => {
          mapApiErrorsToForm(error, methods);
        },
      }
    );
  }, [debouncedCategory, debouncedDetails, campaignId, autosaveMutation.isPending]);

  useFormRegistration("highlights", methods, save);

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
