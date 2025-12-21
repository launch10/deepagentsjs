import { useAutosaveCampaign } from "@api/campaigns.hooks";
import AdPreview from "@components/ads/AdPreview";
import googleLogo from "@assets/google.svg";
import { Field, FieldError, FieldLabel, FieldSet } from "@components/ui/field";
import InfoTooltip from "@components/ui/info-tooltip";
import InputDatePicker from "@components/ui/input-date-picker";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@components/ui/item";
import { formatDateForApi } from "@helpers/formatDateForApi";
import { CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAdsChatState } from "@hooks/useAdsChat";
import { useDebounce } from "@hooks/useDebounce";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { useLaunchFormStore } from "@stores/launchFormStore";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { usePage } from "@inertiajs/react";
import type { CampaignProps } from "@components/ads/Sidebar/WorkflowBuddy/ad-campaign.types";
import {
  GOOGLE_ADVERTISING_CHANNEL_TYPES,
  GOOGLE_BIDDING_STRATEGIES,
  launchFormSchema,
  launchFormDefaults,
  type GoogleAdvertisingChannelType,
  type GoogleBiddingStrategy,
  type LaunchFormData,
} from "./launchForm.schema";

export default function LaunchForm() {
  const { values, setValues } = useLaunchFormStore();
  const campaignId = useAdsChatState("campaignId");
  const autosaveMutation = useAutosaveCampaign(campaignId);
  const { campaign } = usePage<CampaignProps>().props;

  const isInitialMount = useRef(true);
  const lastSavedValue = useRef<string | null>(null);
  const hasInitializedFromProps = useRef(false);

  // Merge campaign name from props into default values if available
  const defaultValues =
    campaign?.name && !values.campaignName ? { ...values, campaignName: campaign.name } : values;

  const methods = useForm<LaunchFormData>({
    resolver: zodResolver(launchFormSchema) as any,
    mode: "onChange",
    defaultValues,
  });

  useFormRegistration("launch", methods);

  // Initialize campaign name from API when available (only once)
  useEffect(() => {
    if (campaign?.name && !hasInitializedFromProps.current) {
      const currentValue = methods.getValues("campaignName");
      // Only initialize if the form value is empty or matches the default
      if (!currentValue || currentValue === launchFormDefaults.campaignName) {
        methods.setValue("campaignName", campaign.name);
        setValues({ campaignName: campaign.name });
        hasInitializedFromProps.current = true;
      }
    }
  }, [campaign?.name, methods, setValues]);

  // Sync form values to Zustand store
  useEffect(() => {
    const subscription = methods.watch((formValues) => {
      setValues(formValues as LaunchFormData);
    });
    return () => subscription.unsubscribe();
  }, [methods, setValues]);

  // Watch all form fields reactively for autosave
  const watchedValues = useWatch({ control: methods.control });
  const debouncedValues = useDebounce(watchedValues as LaunchFormData, 750);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!campaignId || autosaveMutation.isPending) {
      return;
    }

    const apiData = {
      // TODO: Add name to the API data
      google_advertising_channel_type: debouncedValues.googleAdvertisingChannelType,
      google_bidding_strategy: debouncedValues.googleBiddingStrategy,
      start_date: formatDateForApi(debouncedValues.startDate),
      end_date: formatDateForApi(debouncedValues.endDate),
    };
    const serialized = JSON.stringify(apiData);

    if (serialized === lastSavedValue.current) {
      return;
    }
    lastSavedValue.current = serialized;

    autosaveMutation.mutate({ campaign: apiData });
  }, [debouncedValues, campaignId, autosaveMutation.isPending]);

  const googleAdvertisingChannelType = methods.watch("googleAdvertisingChannelType");
  const googleBiddingStrategy = methods.watch("googleBiddingStrategy");

  const channelTypeInfo =
    GOOGLE_ADVERTISING_CHANNEL_TYPES[googleAdvertisingChannelType as GoogleAdvertisingChannelType];
  const biddingStrategyInfo =
    GOOGLE_BIDDING_STRATEGIES[googleBiddingStrategy as GoogleBiddingStrategy];

  return (
    <FormProvider {...methods}>
      <div className="border border-neutral-300 bg-white p-6 rounded-2xl">
        <div className="py-8 px-9 flex flex-col gap-6">
          <FieldSet className="md:max-w-2/3 lg:max-w-1/2">
            {/* Campaign Name */}
            <Field>
              <FieldLabel className="text-base-500">
                <span className="font-semibold">Campaign Name</span>
                <InfoTooltip text="Use a clear, searchable name so it's easy to find and report on later." />
              </FieldLabel>
              <Controller
                name="campaignName"
                control={methods.control}
                render={({ field }) => (
                  <InputGroup>
                    <InputGroupInput {...field} placeholder="Campaign Name" />
                    <InputGroupAddon align="inline-end">
                      <Sparkles size={14} className="text-base-300" />
                    </InputGroupAddon>
                  </InputGroup>
                )}
              />
              <FieldError errors={[{ message: methods.formState.errors.campaignName?.message }]} />
            </Field>

            {/* Campaign Type */}
            <Field>
              <FieldLabel className="text-base-500">
                <span className="font-semibold">Campaign Type</span>
                <InfoTooltip text="Google Search reaches people actively looking for what you offer." />
              </FieldLabel>
              <Item variant="outline" className="border-neutral-300 bg-neutral-50">
                <ItemMedia className="my-auto">
                  <img src={googleLogo} alt="Google Logo" className="size-4" />
                </ItemMedia>
                <ItemContent className="gap-0">
                  <ItemTitle>{channelTypeInfo.label}</ItemTitle>
                  <ItemDescription>{channelTypeInfo.description}</ItemDescription>
                </ItemContent>
              </Item>
            </Field>

            {/* Bidding Strategy */}
            <Field>
              <FieldLabel className="text-base-500">
                <span className="font-semibold">Bidding Strategy</span>
                <InfoTooltip text="Maximum Clicks aims to get the most clicks within your daily budget." />
              </FieldLabel>
              <Item variant="outline" className="border-neutral-300 bg-neutral-50">
                <ItemMedia className="my-auto">
                  <CursorArrowRippleIcon className="size-4 text-base-500" />
                </ItemMedia>
                <ItemContent className="gap-0">
                  <ItemTitle>{biddingStrategyInfo.label}</ItemTitle>
                  <ItemDescription>{biddingStrategyInfo.description}</ItemDescription>
                </ItemContent>
              </Item>
            </Field>

            {/* Start Date and End Date */}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel className="text-base-500">
                  <span className="font-semibold">Start Date</span>
                </FieldLabel>
                <Controller
                  name="startDate"
                  control={methods.control}
                  render={({ field }) => (
                    <InputDatePicker
                      value={field.value.toISOString()}
                      onChange={field.onChange}
                      placeholder="MM/DD/YYYY"
                    />
                  )}
                />
                <FieldError errors={[{ message: methods.formState.errors.startDate?.message }]} />
              </Field>

              <Field>
                <FieldLabel className="text-base-500">
                  <span className="font-semibold">End Date</span>
                </FieldLabel>
                <Controller
                  name="endDate"
                  control={methods.control}
                  render={({ field }) => (
                    <InputDatePicker
                      value={field.value?.toISOString()}
                      onChange={field.onChange}
                      placeholder="MM/DD/YYYY"
                    />
                  )}
                />
                <FieldError errors={[{ message: methods.formState.errors.endDate?.message }]} />
              </Field>
            </div>
          </FieldSet>
        </div>
      </div>
    </FormProvider>
  );
}
