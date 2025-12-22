import {
  settingsFormDefaults,
  type SettingsFormData,
} from "@components/ads/forms/settings-form/settingsForm.schema";
import { createHydratableStore } from "./createHydratableStore";

export const useSettingsFormStore = createHydratableStore<SettingsFormData>(settingsFormDefaults);
