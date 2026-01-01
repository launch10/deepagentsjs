import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FieldGroup } from "@components/ui/field";
import AdCampaignKeywordInput from "./AdCampaignKeywordInput";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads, generateUUID } from "@shared";
import { createRefreshHandler } from "../../utils/refreshAssets";
import { createLockToggleHandler } from "@helpers/handleLockToggle";
import { useAutosaveCampaign } from "@api/campaigns.hooks";
import type { UpdateCampaignRequestBody } from "@rails_api_base";
import AdCampaignFieldList from "../shared/AdCampaignFieldList";

const keywordsFormSchema = z.object({
  keywords: z.array(Ads.AssetSchema),
});

type KeywordsFormData = z.infer<typeof keywordsFormSchema>;

export default function KeywordTargetingForm() {
  const keywords = useAdsChatState("keywords");
  const { setState, updateState } = useAdsChatActions();
  const gridEndRef = useRef<HTMLDivElement>(null);

  const filteredKeywords = (keywords || []).filter((k) => !k.rejected);
  const prevIdsRef = useRef<string[]>([]);

  const methods = useForm<KeywordsFormData>({
    resolver: zodResolver(keywordsFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      keywords: filteredKeywords,
    },
  });

  useEffect(() => {
    const currentIds = filteredKeywords.map((k) => k.id).join(",");
    const prevIds = prevIdsRef.current.join(",");

    if (currentIds !== prevIds) {
      methods.reset({ keywords: filteredKeywords });
      prevIdsRef.current = filteredKeywords.map((k) => k.id);
    }
  }, [filteredKeywords, methods]);

  const handleAddKeyword = (value: string) => {
    const newKeyword: Ads.Keyword = {
      id: generateUUID(),
      text: value,
      locked: false,
      rejected: false,
    };
    setState({ keywords: [...(keywords || []), newKeyword] });

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

  const handleLockToggle = createLockToggleHandler(
    "keywords",
    methods,
    () => filteredKeywords,
    () => keywords,
    setState
  );

  const handleRefreshKeywords = () => {
    createRefreshHandler("keywords", keywords, updateState);
  };

  const handleDeleteKeyword = (index: number) => {
    const keywordId = filteredKeywords[index]?.id;
    if (!keywordId) return;
    setState({ keywords: keywords?.filter((k) => k.id !== keywordId) });
  };

  const handleInputChange = (index: number, input: string) => {
    const keywordId = filteredKeywords[index]?.id;
    if (!keywordId) return;
    setState({
      keywords: keywords?.map((k) => (k.id === keywordId ? { ...k, text: input } : k)),
    });
  };

  const fields = filteredKeywords.map((k) => ({ ...k, id: k.id }));
  const leftColumnFields = fields.filter((_, i) => i % 2 === 0);
  const rightColumnFields = fields.filter((_, i) => i % 2 === 1);

  const resolveIndex = (id: string) => fields.findIndex((f) => f.id === id);

  const { getData } = useAutosaveCampaign<KeywordsFormData>({
    methods,
    formId: "keywords",
    transformFn: (data): Partial<UpdateCampaignRequestBody> | null => {
      const transformed = data.keywords
        ?.filter((k) => k.text?.trim())
        .map(({ id, text }) => ({ id, text, match_type: "broad" }));
      if (!transformed || transformed.length === 0) return null;
      return { keywords: transformed as unknown as UpdateCampaignRequestBody["keywords"] };
    },
  });

  useFormRegistration("keywords", methods, getData);

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
            fields={leftColumnFields as any}
            onLockToggle={handleLockToggle}
            onDelete={handleDeleteKeyword}
            control={methods.control as any}
            placeholder="Keyword Option"
            maxLength={80}
            resolveIndex={resolveIndex}
            onInputChange={handleInputChange}
          />
        </div>
        <div className="flex flex-col gap-4">
          <AdCampaignFieldList
            fieldName="keywords"
            fields={rightColumnFields as any}
            onLockToggle={handleLockToggle}
            onDelete={handleDeleteKeyword}
            control={methods.control as any}
            placeholder="Keyword Option"
            maxLength={80}
            resolveIndex={resolveIndex}
            onInputChange={handleInputChange}
          />
        </div>
        <div ref={gridEndRef} />
      </div>
    </FieldGroup>
  );
}
