import AdCampaignChat from "@components/ad-campaign/ad-campaign-chat/ad-campaign-chat";
import AdCampaignContent from "@components/ad-campaign/ad-campaign-create/ad-campaign-content";
import AdCampaignHighlights from "@components/ad-campaign/ad-campaign-create/ad-campaign-highlights";
import type { AdCampaignFormData } from "@components/ad-campaign/ad-campaign-form/ad-campaign-form.schema";
import { adCampaignSchema } from "@components/ad-campaign/ad-campaign-form/ad-campaign-form.schema";
import AdCampaignPagination from "@components/ad-campaign/ad-campaign-pagination";
import AdCampaignPreview from "@components/ad-campaign/ad-campaign-preview";
import AdCampaignTabSwitcher from "@components/ad-campaign/ad-campaign-tab-switcher";
import type { AdPreviewType, CampaignProps } from "@components/ad-campaign/ad-campaign.types";
import Header from "@components/header/header";
import LogoSpinner from "@components/ui/logo-spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePage } from "@inertiajs/react";
import type { AdsBridgeType } from "@shared";
import { useLanggraph } from "langgraph-ai-sdk-react";
import { useEffect, useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";

const TABS = [
  { id: "content", label: "Content" },
  { id: "highlights", label: "Highlights" },
];

export default function Campaign() {
  const pageProps = usePage<CampaignProps>();
  const [activeTab, setActiveTab] = useState("content");
  const [isLoading, setIsLoading] = useState(true);
  const [previewText, setPreviewText] = useState<AdPreviewType>({
    headline: "",
    url: "",
    details: "",
  });

  const { thread_id, jwt, workflow, langgraph_path } = pageProps.props;

  const url = new URL("api/ads/stream", langgraph_path).toString();
  const { state } = useLanggraph<AdsBridgeType>({
    api: url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    getInitialThreadId: () => (thread_id ? thread_id : undefined),
  });

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
    // Populate the form with AI headlines and descriptions
    if (state && state.headlines) {
      methods.setValue(
        "headlines",
        state.headlines.slice(0, 3).map((h) => ({ value: h.text, isLocked: false }))
      );
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
    // Populate Ad Preview with state values
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

  return (
    <main className="mx-auto container max-w-6xl grid grid-cols-12 gap-10 px-5">
      <div className="col-span-4">
        <AdCampaignChat
          activeStep={(workflow && workflow?.step) || undefined} // TODO: Clean up conditionals
          activeSubstep={(workflow && workflow?.substep) || undefined} // TODO: Clean up conditionals
        />
      </div>
      <div className="col-span-8">
        <AdCampaignPreview
          className="mb-8"
          {...previewText}
          // TODO: Populate URL from...somewhere
        />
        <AdCampaignTabSwitcher tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
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
