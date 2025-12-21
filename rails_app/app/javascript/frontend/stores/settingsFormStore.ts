import { create } from "zustand";
import {
  settingsFormDefaults,
  type SettingsFormData,
} from "@components/ads/forms/settings-form/settingsForm.schema";

interface SettingsFormStore {
  values: SettingsFormData;
  setValues: (values: Partial<SettingsFormData>) => void;
  resetValues: () => void;
}

export const useSettingsFormStore = create<SettingsFormStore>((set) => ({
  values: settingsFormDefaults,
  setValues: (values) =>
    set((state) => ({
      values: { ...state.values, ...values },
    })),
  resetValues: () => set({ values: settingsFormDefaults }),
}));
