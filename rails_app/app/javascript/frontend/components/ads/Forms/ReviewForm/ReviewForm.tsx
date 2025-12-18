import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@components/ui/field";
import { Input } from "@components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { selectSetSubstep, useWorkflowSteps } from "@context/WorkflowStepsProvider";
import { Cog8ToothIcon, CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import { useAdsChatState } from "@hooks/useAdsChat";
import { useStageInit } from "@hooks/useStageInit";
import type { Workflow } from "@shared";
import { Info, Pencil } from "lucide-react";
import ReviewFormFieldGroup from "./ReviewFormFieldGroup";
import ReviewFormSection from "./ReviewFormSection";

export default function ReviewForm() {
  useStageInit("review");

  const headlines = useAdsChatState("headlines");
  const descriptions = useAdsChatState("descriptions");
  const callouts = useAdsChatState("callouts");
  const structuredSnippets = useAdsChatState("structuredSnippets");
  const keywords = useAdsChatState("keywords");

  const setSubstep = useWorkflowSteps(selectSetSubstep);

  const navigateTo = (substep: Workflow.AdCampaignSubstepName) => {
    setSubstep?.(substep);
  };

  const getSelectedItems = <T extends { id: string; text: string; rejected: boolean }>(
    items: T[] | undefined
  ): Array<{ id: string; text: string }> => {
    return (
      items?.filter((item) => !item.rejected).map((item) => ({ id: item.id, text: item.text })) ??
      []
    );
  };

  const selectedHeadlines = getSelectedItems(headlines);
  const selectedDescriptions = getSelectedItems(descriptions);
  const selectedCallouts = getSelectedItems(callouts);
  const snippetDetails = getSelectedItems(structuredSnippets?.details);
  const selectedKeywords = getSelectedItems(keywords);

  return (
    <div className="flex flex-col gap-6">
      <ReviewFormSection title="Ad Content & Highlights">
        <FieldSet className="gap-6">
          {/* Ad Group Name */}
          <FieldGroup className="max-w-1/2 gap-2">
            <Field>
              <div className="flex justify-between items-center">
                <FieldLabel className="text-base-500">
                  Ad Group Name
                  <Info size={12} className="text-base-300" />
                </FieldLabel>
                <Button variant="ghost" size="sm" onClick={() => navigateTo("content")}>
                  <Pencil size={16} />
                  Edit Section
                </Button>
              </div>
            </Field>
            <Input
              value="Ad Group Name"
              readOnly
              className="bg-white border-neutral-300 text-xs cursor-default"
            />
          </FieldGroup>

          {/* Selected Headlines */}
          <ReviewFormFieldGroup
            title={`Selected Headlines (${selectedHeadlines.length})`}
            items={selectedHeadlines}
            onEditSection={() => navigateTo("content")}
          />

          {/* Selected Details (Descriptions) */}
          <ReviewFormFieldGroup
            title={`Selected Details (${selectedDescriptions.length})`}
            items={selectedDescriptions}
            onEditSection={() => navigateTo("content")}
            showPagination={false}
          />

          {/* Unique Features (Callouts) */}
          <ReviewFormFieldGroup
            title="Unique Features"
            items={selectedCallouts}
            onEditSection={() => navigateTo("highlights")}
          />

          {/* Product or Service Offerings (Structured Snippets) */}
          {structuredSnippets?.category && (
            <ReviewFormFieldGroup
              title={`Product or Service Offerings: ${structuredSnippets.category}`}
              items={snippetDetails}
              onEditSection={() => navigateTo("highlights")}
            />
          )}
        </FieldSet>
      </ReviewFormSection>
      <ReviewFormSection title="Keywords">
        <ReviewFormFieldGroup
          title={`Selected Keywords (${selectedKeywords.length})`}
          items={selectedKeywords}
          onEditSection={() => navigateTo("keywords")}
        />
      </ReviewFormSection>
      <ReviewFormSection
        title="Targeting and Budget"
        icon={<CursorArrowRippleIcon className="size-4" />}
        showEditSection={true}
        onEditSection={() => navigateTo("settings")}
      >
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel className="text-base-500">Geo Targeting</FieldLabel>
              <InputGroup>
                <InputGroupInput value="United States" readOnly />
                <InputGroupAddon align="inline-start">Country</InputGroupAddon>
                <InputGroupAddon align="inline-end">Radius: 10 miles</InputGroupAddon>
              </InputGroup>
              <InputGroup>
                <InputGroupInput value="Florida" readOnly />
                <InputGroupAddon align="inline-start">State</InputGroupAddon>
                <InputGroupAddon align="inline-end">Excluded</InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>
        </FieldSet>
        <div className="divide-y divide-neutral-300">
          <div className="flex justify-between items-center py-3">
            <div className="text-sm font-semibold text-base-500">Ad Schedule</div>
            <div className="text-sm flex flex-col gap-1 items-end">
              <span>Mon, Wed, Fri</span>
              <span className="text-base-300">9:00 AM - 5:00 PM</span>
            </div>
          </div>
          <div className="flex justify-between items-center py-3">
            <div className="text-sm font-semibold text-base-500">Daily Budget</div>
            <div className="text-sm">$500</div>
          </div>
        </div>
      </ReviewFormSection>
      <ReviewFormSection
        title="Campaign Settings"
        icon={<Cog8ToothIcon className="size-4" />}
        showEditSection={true}
        onEditSection={() => navigateTo("settings")}
      >
        <div className="divide-y divide-neutral-300">
          <div className="flex justify-between items-center py-4">
            <div className="text-sm font-semibold text-base-500">Campaign Name</div>
            <div className="text-sm">Campaign Name</div>
          </div>
          <div className="flex justify-between items-center py-4">
            <div className="text-sm font-semibold text-base-500">Campaign Type</div>
            <div className="text-sm">Google Search</div>
          </div>
        </div>
      </ReviewFormSection>
    </div>
  );
}
