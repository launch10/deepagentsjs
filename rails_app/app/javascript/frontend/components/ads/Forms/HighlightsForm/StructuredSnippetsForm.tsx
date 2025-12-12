import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@components/ui/field";
import { Select, SelectTrigger, SelectValue } from "@components/ui/select";
import { useAdsChatState, useAdsChatActions } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { Ads } from "@shared";
import { Info, Plus } from "lucide-react";

const structuredSnippetsFormSchema = z.object({
  structuredSnippets: Ads.StructuredSnippetsSchema.optional(),
});

type StructuredSnippetsFormData = z.infer<typeof structuredSnippetsFormSchema>;

export default function StructuredSnippetsForm() {
  const structuredSnippets = useAdsChatState("structuredSnippets");
  const { setState: _setState } = useAdsChatActions();

  const methods = useForm<StructuredSnippetsFormData>({
    resolver: zodResolver(structuredSnippetsFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      structuredSnippets: undefined,
    },
  });

  useEffect(() => {
    if (structuredSnippets) {
      methods.setValue("structuredSnippets", structuredSnippets);
    }
  }, [structuredSnippets, methods]);

  useFormRegistration("highlights", methods);

  return (
    <FieldGroup className="max-w-1/2">
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
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
        </Select>
      </Field>
      <Field>
        <FieldLabel className="flex justify-between items-center">
          <span className="font-semibold text-xs text-base-400">Details</span>
          <Badge variant="secondary" className="ml-auto">
            Select 3-10
          </Badge>
        </FieldLabel>
      </Field>
      <Button type="button" variant="link" className="justify-start">
        <Plus />
        Add Value
      </Button>
    </FieldGroup>
  );
}
