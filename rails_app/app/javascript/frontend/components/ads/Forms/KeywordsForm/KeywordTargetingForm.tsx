import { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field, FieldGroup, FieldError } from "@components/ui/field";
import InputLockable from "@components/forms/input-lockable";
import AdCampaignKeywordInput from "./AdCampaignKeywordInput";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads, generateUUID } from "@shared";
import { createRefreshHandler } from "../../utils/refreshAssets";

const keywordsFormSchema = z.object({
  keywords: z.array(Ads.AssetSchema),
});

type KeywordsFormData = z.infer<typeof keywordsFormSchema>;

export default function KeywordTargetingForm() {
  const keywords = useAdsChatState("keywords");
  const { setState, updateState } = useAdsChatActions();

  const methods = useForm<KeywordsFormData>({
    resolver: zodResolver(keywordsFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      keywords: [],
    },
  });

  const { fields, append } = useFieldArray({
    control: methods.control,
    name: "keywords",
  });

  useEffect(() => {
    if (keywords?.length) {
      const filtered = keywords.filter((k) => !k.rejected);
      methods.setValue("keywords", filtered);
    }
  }, [keywords, methods]);

  useFormRegistration("keywords", methods);

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
  };

  const handleLockToggle = (
    _fieldName: "headlines" | "descriptions" | "features" | "callouts" | "keywords",
    index: number
  ) => {
    const currentFields = methods.getValues("keywords");
    const isLocked = currentFields[index].locked;

    if (!isLocked && !currentFields[index].text) {
      methods.setError(`keywords.${index}.text`, {
        type: "manual",
        message: "Cannot lock an empty input.",
      });
      return;
    }

    const updatedFields = currentFields.map((field, i) =>
      i === index ? { ...field, locked: !isLocked } : field
    );
    methods.setValue("keywords", updatedFields);

    const updatedLanggraph = keywords?.map((k, i) =>
      i === index ? { ...k, locked: !isLocked } : k
    );
    setState({ keywords: updatedLanggraph });
  };

  const handleRefreshKeywords = () => {
    createRefreshHandler("keywords", keywords, updateState);
  };

  const leftColumnFields = fields.filter((_, i) => i % 2 === 0);
  const rightColumnFields = fields.filter((_, i) => i % 2 === 1);

  const renderField = (field: typeof fields[number]) => {
    const actualIndex = fields.findIndex((f) => f.id === field.id);
    return (
      <Controller
        key={field.id}
        name={`keywords.${actualIndex}.text`}
        control={methods.control}
        render={({ field: controllerField, fieldState }) => (
          <Field className="gap-1">
            <InputLockable
              placeholder="Keyword Option"
              {...controllerField}
              isLocked={field.locked}
              onLockToggle={() => handleLockToggle("keywords", actualIndex)}
            />
            <div className="flex">
              {fieldState.error && <FieldError errors={[fieldState.error]} />}
              <div className="text-right text-xs text-[#8b8b8b] ml-auto">
                {controllerField.value?.length ?? 0}/80
              </div>
            </div>
          </Field>
        )}
      />
    );
  };

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
          {leftColumnFields.map((field) => renderField(field))}
        </div>
        <div className="flex flex-col gap-4">
          {rightColumnFields.map((field) => renderField(field))}
        </div>
      </div>
    </FieldGroup>
  );
}
