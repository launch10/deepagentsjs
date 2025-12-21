import { useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FieldGroup } from "@components/ui/field";
import AdCampaignKeywordInput from "./AdCampaignKeywordInput";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads, generateUUID } from "@shared";
import { createRefreshHandler } from "../../utils/refreshAssets";
import { createLockToggleHandler } from "@helpers/handleLockToggle";
import { useCampaignAutosave } from "@hooks/useCampaignAutosave";
import AdCampaignFieldList from "../shared/AdCampaignFieldList";

const keywordsFormSchema = z.object({
  keywords: z.array(Ads.AssetSchema),
});

type KeywordsFormData = z.infer<typeof keywordsFormSchema>;

export default function KeywordTargetingForm() {
  const keywords = useAdsChatState("keywords");
  const { setState, updateState } = useAdsChatActions();
  const gridEndRef = useRef<HTMLDivElement>(null);

  const methods = useForm<KeywordsFormData>({
    resolver: zodResolver(keywordsFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      keywords: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: "keywords",
  });

  useEffect(() => {
    if (keywords?.length) {
      const filtered = keywords.filter((k) => !k.rejected);
      methods.setValue("keywords", filtered);
    }
  }, [keywords, methods]);

  const handleAddKeyword = (value: string) => {
    const newKeyword: Ads.Keyword = {
      id: generateUUID(),
      text: value,
      locked: false,
      rejected: false,
    };
    append(newKeyword);

    const updated = [...(keywords || []), newKeyword];
    setState({ keywords: updated });

    // Scroll the new keyword into view after it's rendered
    // Account for the sticky pagination bar at the bottom (~80px)
    setTimeout(() => {
      const element = gridEndRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const paginationHeight = 80;
      const viewportBottom = window.innerHeight - paginationHeight;

      if (rect.bottom > viewportBottom) {
        window.scrollBy({
          top: rect.bottom - viewportBottom + 16,
          behavior: "smooth",
        });
      }
    }, 0);
  };

  const handleLockToggle = createLockToggleHandler(methods, "keywords", () => keywords, setState);

  const handleRefreshKeywords = () => {
    createRefreshHandler("keywords", keywords, updateState);
  };

  const handleDeleteKeyword = (index: number) => {
    remove(index);
    const updatedLanggraph = keywords?.filter((k, i) => i !== index);
    setState({ keywords: updatedLanggraph });
  };

  const leftColumnFields = fields.filter((_, i) => i % 2 === 0);
  const rightColumnFields = fields.filter((_, i) => i % 2 === 1);

  const resolveIndex = (id: string) => fields.findIndex((f) => f.id === id);

  const { save } = useCampaignAutosave({
    methods,
    fieldMappings: [
      {
        formField: "keywords",
        apiField: "keywords",
        transform: (keywords) =>
          keywords
            ?.filter((k) => k.text?.trim())
            .map(({ id, text }) => ({ id, text, match_type: "broad" })) ?? [],
      },
    ],
    values: [keywords],
  });

  // Attach save function to form registration
  useFormRegistration("keywords", methods, save);

  return (
    <FieldGroup className="gap-4">
      <AdCampaignKeywordInput
        onAdd={handleAddKeyword}
        currentCount={fields.length}
        maxCount={15}
        error={methods.formState.errors.keywords?.message}
        onRefreshSuggestions={handleRefreshKeywords}
      />
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <div className="flex flex-col gap-4">
          <AdCampaignFieldList
            fieldName="keywords"
            fields={leftColumnFields}
            onLockToggle={handleLockToggle}
            onDelete={handleDeleteKeyword}
            control={methods.control as any}
            placeholder="Keyword Option"
            maxLength={80}
            resolveIndex={resolveIndex}
          />
        </div>
        <div className="flex flex-col gap-4">
          <AdCampaignFieldList
            fieldName="keywords"
            fields={rightColumnFields}
            onLockToggle={handleLockToggle}
            onDelete={handleDeleteKeyword}
            control={methods.control as any}
            placeholder="Keyword Option"
            maxLength={80}
            resolveIndex={resolveIndex}
          />
        </div>
        <div ref={gridEndRef} />
      </div>
    </FieldGroup>
  );
}
