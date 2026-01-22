import { useEffect, useEffectEvent } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePage } from "@inertiajs/react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@components/ui/alert";
import { FieldSet } from "@components/ui/field";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { useSettingsFormStore } from "@stores/settingsFormStore";
import { useAutosaveCampaign } from "@api/campaigns.hooks";
import type { CampaignProps } from "@components/ads/workflow-panel/workflow-buddy/ad-campaign.types";
import LocationTargeting from "./LocationTargeting";
import AdSchedule from "./AdSchedule";
import DailyBudget from "./DailyBudget";
import { settingsFormSchema, type SettingsFormData } from "./settingsForm.schema";
import {
  transformSettingsFormToApi,
  transformLocationsFromApi,
  transformScheduleFromApi,
  transformBudgetFromApi,
} from "./settingsForm.transforms";

export default function SettingsForm() {
  const { values, setValues, hydrateOnce } = useSettingsFormStore();
  const { campaign, location_targets, ad_schedule } = usePage<CampaignProps>().props;

  const methods = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema) as any,
    mode: "onChange",
    defaultValues: values,
  });

  const hydrate = useEffectEvent(() => {
    const inertiaProps: SettingsFormData = {
      locations: transformLocationsFromApi(location_targets),
      ...transformScheduleFromApi(ad_schedule),
      budget: transformBudgetFromApi(campaign?.daily_budget_cents),
    };

    if (hydrateOnce(inertiaProps)) {
      methods.reset(inertiaProps);
    }
  });

  useEffect(() => {
    hydrate();
  }, [location_targets, ad_schedule, campaign?.daily_budget_cents]);

  useEffect(() => {
    const subscription = methods.watch((formValues) => {
      setValues(formValues as SettingsFormData);
    });
    return () => subscription.unsubscribe();
  }, [methods, setValues]);

  const { getData, autosaveError } = useAutosaveCampaign<SettingsFormData>({
    methods,
    formId: "settings",
    transformFn: transformSettingsFormToApi,
  });

  const rootError = methods.formState.errors.root?.message || autosaveError?.message;

  useFormRegistration("settings", methods, getData);

  return (
    <FormProvider {...methods}>
      <div
        className="border border-neutral-300 border-t-0 rounded-b-2xl bg-white"
        data-testid="settings-form"
      >
        <div className="py-8 pl-9 pr-[97px] flex flex-col gap-6">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold leading-[22px]">Settings</h2>
            <p className="text-xs text-base-300">
              Keywords are the words and phrases people search for on Google. Choosing the right
              ones helps your ads reach the right customers at the right time.
            </p>
          </div>
          {rootError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{rootError}</AlertDescription>
            </Alert>
          )}
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
