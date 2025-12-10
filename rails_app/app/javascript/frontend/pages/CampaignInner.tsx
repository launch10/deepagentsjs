import AdCampaignChat from "@components/ad-campaign/ad-campaign-chat/ad-campaign-chat";
import AdCampaignContent from "@components/ad-campaign/ad-campaign-create/ad-campaign-content";
import AdCampaignHighlights from "@components/ad-campaign/ad-campaign-create/ad-campaign-highlights";
import type { AdCampaignFormData } from "@components/ad-campaign/ad-campaign-form/ad-campaign-form.schema";
import { adCampaignSchema } from "@components/ad-campaign/ad-campaign-form/ad-campaign-form.schema";
import AdCampaignPagination from "@components/ad-campaign/ad-campaign-pagination";
import AdCampaignPreview from "@components/ad-campaign/ad-campaign-preview";
import AdCampaignTabSwitcher from "@components/ad-campaign/ad-campaign-tab-switcher";
import type { AdPreviewType, CampaignProps } from "@components/ad-campaign/ad-campaign.types";
import LogoSpinner from "@components/ui/logo-spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePage } from "@inertiajs/react";
import { useLanggraphContext } from "@contexts/langgraph-context";
import { useEffect, useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { Ads, type UUIDType } from "@shared";

interface CampaignInnerProps {
  tabs: { id: string; label: string }[];
}

export default function CampaignInner({ tabs }: CampaignInnerProps) {
  const pageProps = usePage<CampaignProps>();
  const { campaign, workflow, project } = pageProps.props;
  const campaignExists = Boolean(campaign?.id);

  const [activeTab, setActiveTab] = useState("content");
  const [isLoading, setIsLoading] = useState(true);
  const [previewText, setPreviewText] = useState<AdPreviewType>({
    headline: "",
    url: "",
    details: "",
  });

  const { state, updateState } = useLanggraphContext();

  useEffect(() => {
    if (!workflow || !workflow.substep || !project?.uuid) return;
    if (campaignExists && workflow.substep === "content") return;
    if (
      state.hasStartedStep &&
      workflow.substep in state.hasStartedStep &&
      state.hasStartedStep[workflow.substep as Ads.StageName] === true
    )
      return;

    updateState({
      stage: workflow.substep as Ads.StageName,
      projectUUID: project.uuid as UUIDType,
    });
  }, [workflow?.substep, state.hasStartedStep]);

  const methods = useForm<AdCampaignFormData>({
    resolver: zodResolver(adCampaignSchema),
    mode: "onChange",
    defaultValues: {
      adGroupName: "Ad Group Name",
      headlines: [
        { value: "Headline Option 1", isLocked: false },
        { value: "Headline Option 2", isLocked: false },
        { value: "Headline Option 3", isLocked: false },
      ],
      descriptions: [
        { value: "Description Option 1", isLocked: false },
        { value: "Description Option 2", isLocked: false },
        { value: "Description Option 3", isLocked: false },
        { value: "Description Option 4", isLocked: false },
      ],
      features: [
        { value: "Feature Option 1", isLocked: false },
        { value: "Feature Option 2", isLocked: false },
        { value: "Feature Option 3", isLocked: false },
        { value: "Feature Option 4", isLocked: false },
        { value: "Feature Option 5", isLocked: false },
        { value: "Feature Option 6", isLocked: false },
      ],
    },
  });

  useEffect(() => {
    if (state && state.headlines) {
      const existingHeadlines = methods.getValues("headlines");
      const newHeadlines = state.headlines.slice(0, 3);

      const mergedHeadlines = existingHeadlines.map((existing, i) =>
        existing.isLocked
          ? existing
          : {
              value: newHeadlines[i]?.text ?? "",
              isLocked: false,
            }
      );

      while (mergedHeadlines.length < 3) {
        mergedHeadlines.push({
          value: newHeadlines[mergedHeadlines.length]?.text ?? "",
          isLocked: false,
        });
      }

      methods.setValue("headlines", mergedHeadlines);
    }
    if (state && state.descriptions) {
      const populatedDescriptions = state.descriptions
        .slice(0, 2)
        .map((d) => ({ value: d.text, isLocked: false }));
      const emptyDescription = { value: "", isLocked: false };
      methods.setValue("descriptions", [
        ...populatedDescriptions,
        emptyDescription,
        emptyDescription,
      ]);
    }
  }, [state?.headlines, state?.descriptions]);

  const watchedHeadlines = useWatch({ control: methods.control, name: "headlines" });
  const watchedDescriptions = useWatch({ control: methods.control, name: "descriptions" });

  useEffect(() => {
    const headlines = watchedHeadlines?.slice(0, 3) ?? [];
    const previewHeadline = headlines.map((h) => h.value).join(" | ");
    const previewDescription = watchedDescriptions?.[0]?.value;

    setPreviewText((prev) => ({
      ...prev,
      headline: previewHeadline,
      details: previewDescription,
    }));

    setIsLoading(false);
  }, [watchedHeadlines, watchedDescriptions]);

  const { fields: headlinesFields, append: appendHeadlines } = useFieldArray({
    control: methods.control,
    name: "headlines",
  });

  const { fields: descriptionsFields } = useFieldArray({
    control: methods.control,
    name: "descriptions",
  });

  const { fields: featuresFields } = useFieldArray({
    control: methods.control,
    name: "features",
  });

  const handleRefreshSuggestions = (fieldName: "headlines" | "descriptions") => {
    const numLocked = methods.getValues(fieldName).filter((field) => field.isLocked).length;
    updateState({
      refresh: { asset: fieldName, nVariants: 6 - numLocked },
      headlines: state.headlines,
      descriptions: state.descriptions,
    });
  };

  const handleRefreshAllSuggestions = () => {
    console.log("refresh all suggestions");
  };

  return (
    <main className="mx-auto container max-w-6xl grid grid-cols-12 gap-10 px-5">
      <div className="col-span-4">
        <AdCampaignChat
          activeStep={(workflow && workflow?.step) || undefined}
          activeSubstep={(workflow && workflow?.substep) || undefined}
          onRefreshSuggestions={handleRefreshAllSuggestions}
        />
      </div>
      <div className="col-span-8">
        <AdCampaignPreview className="mb-8" {...previewText} />
        <AdCampaignTabSwitcher tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        {isLoading ? (
          <div className="border-[#D3D2D0] border border-t-0 rounded-b-2xl bg-white">
            <div className="flex items-center justify-center p-9">
              <LogoSpinner />
            </div>
          </div>
        ) : (
          <FormProvider {...methods}>
            {activeTab === "content" && (
              <AdCampaignContent
                methods={methods}
                headlinesFields={headlinesFields}
                descriptionsFields={descriptionsFields}
                appendHeadlines={appendHeadlines}
                onRefreshSuggestions={handleRefreshSuggestions}
              />
            )}
            {activeTab === "highlights" && <AdCampaignHighlights featuresFields={featuresFields} />}
            <AdCampaignPagination canContinue={false} />
          </FormProvider>
        )}
      </div>
    </main>
  );
}
