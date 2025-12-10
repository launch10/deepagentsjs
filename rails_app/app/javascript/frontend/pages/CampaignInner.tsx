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
import { useEffect, useRef, useState } from "react";
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
  }, [workflow?.substep]);

  const methods = useForm<AdCampaignFormData>({
    resolver: zodResolver(adCampaignSchema),
    mode: "onChange",
    defaultValues: {
      adGroupName: "Ad Group Name",
      headlines: [
        { text: "Headline Option 1", locked: false, rejected: false },
        { text: "Headline Option 2", locked: false, rejected: false },
        { text: "Headline Option 3", locked: false, rejected: false },
      ],
      descriptions: [
        { text: "Description Option 1", locked: false, rejected: false },
        { text: "Description Option 2", locked: false, rejected: false },
        { text: "Description Option 3", locked: false, rejected: false },
        { text: "Description Option 4", locked: false, rejected: false },
      ],
      features: [
        { text: "Feature Option 1", locked: false, rejected: false },
        { text: "Feature Option 2", locked: false, rejected: false },
        { text: "Feature Option 3", locked: false, rejected: false },
        { text: "Feature Option 4", locked: false, rejected: false },
        { text: "Feature Option 5", locked: false, rejected: false },
        { text: "Feature Option 6", locked: false, rejected: false },
      ],
    },
  });

  useEffect(() => {
    if (state && state.headlines) {
      const headlines = state.headlines.filter((h) => h.rejected !== true)
      methods.setValue("headlines", headlines);
    }
    if (state && state.descriptions) {
      const populatedDescriptions = state.descriptions
        .slice(0, 2)
        .filter((d) => d.rejected !== true);
      const emptyDescription = { text: "", locked: false, rejected: false };
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
    const previewHeadline = headlines.map((h) => h.text).join(" | ");
    const previewDescription = watchedDescriptions?.[0]?.text;

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
    const numLocked = methods.getValues(fieldName).filter((field) => field.locked).length;
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
