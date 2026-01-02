import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@components/ui/field";
import { Input } from "@components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import {
  selectSetSubstep,
  selectReturnToSection,
  selectClearReturnToSection,
  useWorkflow,
} from "@context/WorkflowProvider";
import { Cog8ToothIcon, CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import { useAdsChatState } from "@hooks/useAdsChat";
import { useStageInit } from "@hooks/useStageInit";
import { useScrollToSection } from "@hooks/useScrollToSection";
import { useSettingsFormStore } from "@stores/settingsFormStore";
import { useLaunchFormStore } from "@stores/launchFormStore";
import { formatDate, formatSchedule, getSelectedItems } from "@helpers/formatUtils";
import {
  GOOGLE_ADVERTISING_CHANNEL_TYPES,
  GOOGLE_BIDDING_STRATEGIES,
  type GoogleAdvertisingChannelType,
  type GoogleBiddingStrategy,
} from "@components/ads/forms/launch-form/launchForm.schema";
import type { Workflow } from "@shared";
import { Info, Pencil } from "lucide-react";
import { ReviewItem, ReviewItemList } from "./ReviewItem";
import ReviewFormFieldGroup from "./ReviewFormFieldGroup";
import ReviewFormSection from "./ReviewFormSection";

// Section IDs for scroll targeting
const SECTION_IDS = {
  content: "review-section-content",
  highlights: "review-section-highlights",
  keywords: "review-section-keywords",
  settings: "review-section-settings",
  launch: "review-section-launch",
} as const;

export default function ReviewForm() {
  useStageInit("review");

  const headlines = useAdsChatState("headlines");
  const descriptions = useAdsChatState("descriptions");
  const callouts = useAdsChatState("callouts");
  const structuredSnippets = useAdsChatState("structuredSnippets");
  const keywords = useAdsChatState("keywords");

  // Settings form data
  const { values: settingsValues } = useSettingsFormStore();
  const { locations, selectedDays, startTime, endTime, timezone, budget } = settingsValues;

  // Launch form data
  const { values: launchValues } = useLaunchFormStore();
  const { campaignName, googleAdvertisingChannelType, googleBiddingStrategy, startDate, endDate } =
    launchValues;

  const setSubstep = useWorkflow(selectSetSubstep);
  const returnToSection = useWorkflow(selectReturnToSection);
  const clearReturnToSection = useWorkflow(selectClearReturnToSection);

  useScrollToSection(returnToSection, clearReturnToSection);

  const navigateTo = (substep: Workflow.AdCampaignSubstepName, sectionId: string) => {
    // Store the section ID so we can scroll back to it when returning
    // This preserves the user's placement on the page
    setSubstep?.(substep, sectionId);
  };

  const selectedHeadlines = getSelectedItems(headlines);
  const selectedDescriptions = getSelectedItems(descriptions);
  const selectedCallouts = getSelectedItems(callouts);
  const snippetDetails = getSelectedItems(structuredSnippets?.details);
  const selectedKeywords = getSelectedItems(keywords);

  // Get campaign type label
  const getCampaignTypeLabel = () => {
    return (
      GOOGLE_ADVERTISING_CHANNEL_TYPES[googleAdvertisingChannelType as GoogleAdvertisingChannelType]
        ?.label ?? googleAdvertisingChannelType
    );
  };

  // Get bidding strategy label
  const getBiddingStrategyLabel = () => {
    return (
      GOOGLE_BIDDING_STRATEGIES[googleBiddingStrategy as GoogleBiddingStrategy]?.label ??
      googleBiddingStrategy
    );
  };

  const schedule = formatSchedule({
    days: selectedDays,
    startTime,
    endTime,
    timezone,
  });

  return (
    <div className="flex flex-col gap-6" data-testid="review-form">
      <ReviewFormSection id={SECTION_IDS.content} title="Ad Content & Highlights">
        <FieldSet className="gap-6">
          {/* Ad Group Name */}
          <FieldGroup className="max-w-1/2 gap-2">
            <Field>
              <div className="flex justify-between items-center">
                <FieldLabel className="text-base-500">
                  Ad Group Name
                  <Info size={12} className="text-base-300" />
                </FieldLabel>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateTo("content", SECTION_IDS.content)}
                >
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
            onEditSection={() => navigateTo("content", SECTION_IDS.content)}
          />

          {/* Selected Details (Descriptions) */}
          <ReviewFormFieldGroup
            title={`Selected Details (${selectedDescriptions.length})`}
            items={selectedDescriptions}
            onEditSection={() => navigateTo("content", SECTION_IDS.content)}
            showPagination={false}
          />

          {/* Unique Features (Callouts) */}
          <ReviewFormFieldGroup
            title="Unique Features"
            items={selectedCallouts}
            onEditSection={() => navigateTo("highlights", SECTION_IDS.content)}
          />

          {/* Product or Service Offerings (Structured Snippets) */}
          {structuredSnippets?.category && (
            <ReviewFormFieldGroup
              title={`Product or Service Offerings: ${structuredSnippets.category}`}
              items={snippetDetails}
              onEditSection={() => navigateTo("highlights", SECTION_IDS.content)}
            />
          )}
        </FieldSet>
      </ReviewFormSection>
      <ReviewFormSection id={SECTION_IDS.keywords} title="Keywords">
        <ReviewFormFieldGroup
          title={`Selected Keywords (${selectedKeywords.length})`}
          items={selectedKeywords}
          onEditSection={() => navigateTo("keywords", SECTION_IDS.keywords)}
        />
      </ReviewFormSection>
      <ReviewFormSection
        id={SECTION_IDS.settings}
        title="Targeting and Budget"
        icon={<CursorArrowRippleIcon className="size-4" />}
        showEditSection={true}
        onEditSection={() => navigateTo("settings", SECTION_IDS.settings)}
      >
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel className="text-base-500">Geo Targeting</FieldLabel>
              {locations.length > 0 ? (
                locations.map((location) => (
                  <InputGroup key={location.criteria_id}>
                    <InputGroupInput value={location.name} readOnly />
                    <InputGroupAddon align="inline-start">{location.target_type}</InputGroupAddon>
                    <InputGroupAddon align="inline-end">
                      {location.isTargeted ? "Targeted" : "Excluded"}
                    </InputGroupAddon>
                  </InputGroup>
                ))
              ) : (
                <InputGroup>
                  <InputGroupInput value="No locations selected" readOnly />
                </InputGroup>
              )}
            </Field>
          </FieldGroup>
        </FieldSet>
        <ReviewItemList>
          <ReviewItem label="Ad Schedule">
            <div className="flex flex-col gap-1 items-end">
              <span>{schedule.days || "No days selected"}</span>
              <span className="text-base-300">{schedule.timeRange}</span>
            </div>
          </ReviewItem>
          <ReviewItem label="Daily Budget">${budget}</ReviewItem>
        </ReviewItemList>
      </ReviewFormSection>
      <ReviewFormSection
        id={SECTION_IDS.launch}
        title="Campaign Settings"
        icon={<Cog8ToothIcon className="size-4" />}
        showEditSection={true}
        onEditSection={() => navigateTo("launch", SECTION_IDS.launch)}
      >
        <ReviewItemList>
          <ReviewItem label="Campaign Name" className="py-4">
            {campaignName || "Not set"}
          </ReviewItem>
          <ReviewItem label="Campaign Type" className="py-4">
            {getCampaignTypeLabel()}
          </ReviewItem>
          <ReviewItem label="Bidding Strategy" className="py-4">
            {getBiddingStrategyLabel()}
          </ReviewItem>
          <ReviewItem label="Duration" className="py-4">
            {formatDate(startDate, {
              formatOptions: { month: "2-digit", day: "2-digit", year: "numeric" },
              fallback: "Not set",
            })}{" "}
            -{" "}
            {formatDate(endDate, {
              formatOptions: { month: "2-digit", day: "2-digit", year: "numeric" },
              fallback: "Not set",
            })}
          </ReviewItem>
        </ReviewItemList>
      </ReviewFormSection>
    </div>
  );
}
