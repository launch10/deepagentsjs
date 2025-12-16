import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldSet } from "@components/ui/field";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { useSettingsFormStore } from "@stores/settingsFormStore";
import LocationTargeting from "./LocationTargeting";
import AdSchedule from "./AdSchedule";
import DailyBudget from "./DailyBudget";
import { settingsFormSchema, type SettingsFormData } from "./settingsForm.schema";

export default function SettingsForm() {
  const { values, setValues } = useSettingsFormStore();

  const methods = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema) as any,
    mode: "onChange",
    defaultValues: values,
  });

  useFormRegistration("settings", methods);

  useEffect(() => {
    const subscription = methods.watch((formValues) => {
      setValues(formValues as SettingsFormData);
    });
    return () => subscription.unsubscribe();
  }, [methods, setValues]);

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
