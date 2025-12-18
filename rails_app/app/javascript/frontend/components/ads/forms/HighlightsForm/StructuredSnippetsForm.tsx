import AdCampaignFieldList from "@components/ads/Forms/shared/AdCampaignFieldList";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@components/ui/field";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAdsChatActions, useAdsChatState } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads, generateUUID, keyBy } from "@shared";
import { Info, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
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
  value: key, // Use the lowercase key (e.g., "brands") for API validation
  label: Ads.StructuredSnippetCategories[key].key, // Use display name for UI
}));

// Map from display name (e.g., "Brands") to API key (e.g., "brands")
const displayNameToKey = Object.fromEntries(
  Ads.StructuredSnippetCategoryKeys.map((key) => [Ads.StructuredSnippetCategories[key].key, key])
);

// Normalize category: if it's a display name, convert to API key
const normalizeCategory = (category: string | undefined): string => {
  if (!category) return "";
  // If it's already a valid API key, return it
  if (Ads.StructuredSnippetCategoryKeys.includes(category as any)) {
    return category;
  }
  // Otherwise, try to map from display name
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

  const category = normalizeCategory(structuredSnippets?.category);
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

  const campaignId = useAdsChatState("campaignId");
  const autosaveMutation = useAutosaveCampaign(campaignId);

  // Custom save function for structured snippets that combines category and details
  const save = async () => {
    if (!campaignId) {
      return;
    }

    const category = methods.getValues("category");
    const details = methods.getValues("details");
    const values =
      details
        ?.filter((d: { text?: string }) => d.text?.trim())
        .map((d: { text: string }) => d.text) ?? [];

    // Only save if category and values are present
    if (!category || values.length === 0) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      autosaveMutation.mutate(
        {
          campaign: {
            structured_snippet: {
              category,
              values,
            },
          },
        },
        {
          onSuccess: () => {
            resolve();
          },
          onError: (error) => {
            mapApiErrorsToForm(error, methods);
            reject(error);
          },
        }
      );
    });
  };

  // Custom autosave for structured snippets (category + details combined)
  const watchedCategory = methods.watch("category");
  const watchedDetails = methods.watch("details");
  const debouncedCategory = useDebounce(watchedCategory, 750);
  const debouncedDetails = useDebounce(watchedDetails, 750);
  const isInitialMount = useRef(true);
  const lastSavedValue = useRef<string | null>(null);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!campaignId || autosaveMutation.isPending) {
      return;
    }

    const values =
      debouncedDetails
        ?.filter((d: { text?: string }) => d.text?.trim())
        .map((d: { text: string }) => d.text) ?? [];

    // Only save if category and values are present
    if (!debouncedCategory || values.length === 0) {
      return;
    }

    const serialized = JSON.stringify({ category: debouncedCategory, values });
    if (serialized === lastSavedValue.current) {
      return;
    }
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

  // Attach save function to form registration
  useFormRegistration("highlights", methods, save);

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
                  {STRUCTURED_SNIPPET_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
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
          />
        </FieldGroup>
        <Button type="button" variant="ghost" size="sm" onClick={handleAddDetail}>
          <Plus /> Add Value
        </Button>
      </div>
    </div>
  );
}
