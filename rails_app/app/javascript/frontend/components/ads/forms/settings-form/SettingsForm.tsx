import { useEffect, useRef } from "react";
import { useForm, useWatch, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePage } from "@inertiajs/react";
import { FieldSet } from "@components/ui/field";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { useSettingsFormStore } from "@stores/settingsFormStore";
import { useAutosaveCampaign } from "@api/campaigns.hooks";
import { useDebounce } from "@hooks/useDebounce";
import type { CampaignProps } from "@components/ads/sidebar/workflow-buddy/ad-campaign.types";
import LocationTargeting from "./LocationTargeting";
import AdSchedule from "./AdSchedule";
import DailyBudget from "./DailyBudget";
import { settingsFormSchema, settingsFormDefaults, type SettingsFormData } from "./settingsForm.schema";
import {
  transformSettingsFormToApi,
  transformLocationsFromApi,
  transformScheduleFromApi,
  transformBudgetFromApi,
} from "./settingsForm.transforms";

export default function SettingsForm() {
  const { values, setValues } = useSettingsFormStore();
  const { campaign, location_targets, ad_schedule } = usePage<CampaignProps>().props;
  const campaignId = campaign?.id;
  const autosaveMutation = useAutosaveCampaign(campaignId);

  const isInitialMount = useRef(true);
  const lastSavedValue = useRef<string | null>(null);
  const hasInitializedFromProps = useRef(false);

  const methods = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema) as any,
    mode: "onChange",
    defaultValues: values,
  });

  useFormRegistration("settings", methods);

  useEffect(() => {
    if (hasInitializedFromProps.current) return;

    const locations = transformLocationsFromApi(location_targets);
    const schedule = transformScheduleFromApi(ad_schedule);
    const budget = transformBudgetFromApi(campaign?.daily_budget_cents);

    const hasData =
      locations.length > 0 ||
      schedule.selectedDays !== settingsFormDefaults.selectedDays ||
      budget !== settingsFormDefaults.budget;

    if (hasData) {
      const newValues: SettingsFormData = {
        locations,
        selectedDays: schedule.selectedDays,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        timezone: schedule.timezone,
        budget,
      };

      methods.reset(newValues);
      setValues(newValues);
      hasInitializedFromProps.current = true;
    }
  }, [location_targets, ad_schedule, campaign?.daily_budget_cents, methods, setValues]);

  // Sync form values to Zustand store
  useEffect(() => {
    const subscription = methods.watch((formValues) => {
      setValues(formValues as SettingsFormData);
    });
    return () => subscription.unsubscribe();
  }, [methods, setValues]);

  // Watch all form fields reactively for autosave
  const watchedValues = useWatch({ control: methods.control });
  const debouncedValues = useDebounce(watchedValues as SettingsFormData, 750);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!campaignId || autosaveMutation.isPending) {
      return;
    }

    const apiData = transformSettingsFormToApi(debouncedValues);
    const serialized = JSON.stringify(apiData);

    if (serialized === lastSavedValue.current) {
      return;
    }
    lastSavedValue.current = serialized;

    autosaveMutation.mutate({ campaign: apiData });
  }, [debouncedValues, campaignId, autosaveMutation.isPending]);

  return (
    <FormProvider {...methods}>
      <div className="border border-neutral-300 border-t-0 rounded-b-2xl bg-white">
        <div className="py-8 pl-9 pr-[97px] flex flex-col gap-6">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold leading-[22px]">Settings</h2>
            <p className="text-xs text-base-300">
              Keywords are the words and phrases people search for on Google. Choosing the right
              ones helps your ads reach the right customers at the right time.
            </p>
          </div>
          <FieldSet>
            <LocationTargeting />
            <AdSchedule />
            <DailyBudget />
          </FieldSet>
        </div>
      </div>
    </FormProvider>
  );
}
