import googleLogo from "@assets/google.svg";
import { Field, FieldError, FieldLabel, FieldSet } from "@components/ui/field";
import InfoTooltip from "@components/ui/info-tooltip";
import InputDatePicker from "@components/ui/input-date-picker";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@components/ui/item";
import { CursorArrowRippleIcon } from "@heroicons/react/24/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { useAutosaveCampaign } from "@api/campaigns.hooks";
import { useLaunchFormStore } from "@stores/launchFormStore";
import { Sparkles } from "lucide-react";
import { useEffect, useEffectEvent } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { usePage } from "@inertiajs/react";
import type { CampaignProps } from "@components/ads/sidebar/workflow-buddy/ad-campaign.types";
import {
  GOOGLE_ADVERTISING_CHANNEL_TYPES,
  GOOGLE_BIDDING_STRATEGIES,
  launchFormSchema,
  launchFormDefaults,
  type GoogleAdvertisingChannelType,
  type GoogleBiddingStrategy,
  type LaunchFormData,
} from "./launchForm.schema";
import { transformLaunchFormToApi } from "./launchForm.transforms";

export default function LaunchForm() {
  const { values, setValues, hydrateOnce } = useLaunchFormStore();
  const { campaign } = usePage<CampaignProps>().props;

  const methods = useForm<LaunchFormData>({
    resolver: zodResolver(launchFormSchema) as any,
    mode: "onChange",
    defaultValues: values,
  });

  const hydrate = useEffectEvent(() => {
    if (campaign?.name) {
      const newValues: LaunchFormData = {
        ...launchFormDefaults,
        campaignName: campaign.name,
      };
      if (hydrateOnce(newValues)) {
        methods.reset(newValues);
      }
    }
  });

  useEffect(() => {
    hydrate();
  }, [campaign?.name]);

  useEffect(() => {
    const subscription = methods.watch((formValues) => {
      setValues(formValues as LaunchFormData);
    });
    return () => subscription.unsubscribe();
  }, [methods, setValues]);

  const { getData } = useAutosaveCampaign<LaunchFormData>({
    methods,
    formId: "launch",
    transformFn: transformLaunchFormToApi,
  });

  useFormRegistration("launch", methods, getData);

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
