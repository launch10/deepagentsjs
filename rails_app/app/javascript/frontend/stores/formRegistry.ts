import { create } from "zustand";

type FormData = Record<string, unknown>;

type FormHandle = {
  validate: () => Promise<boolean>;
  getData?: () => FormData | null;
};

type ValidateAndSaveResult = {
  valid: boolean;
  error?: Error;
};

type FormRegistryState = {
  formNames: Record<string, FormHandle[]>;
};

type FormRegistryActions = {
  register: (formName: string, handle: FormHandle) => () => void;
  validate: (formName: string) => Promise<boolean>;
  validateAndSave: (
    formName: string,
    saveFn: (data: FormData) => Promise<void>
  ) => Promise<ValidateAndSaveResult>;
};

type FormRegistryStore = FormRegistryState & FormRegistryActions;

export const useFormRegistry = create<FormRegistryStore>((set, get) => ({
  formNames: {},

  register: (formName, handle) => {
    set((s) => ({
      formNames: {
        ...s.formNames,
        [formName]: [...(s.formNames[formName] || []), handle],
      },
    }));

    return () => {
      set((s) => ({
        formNames: {
          ...s.formNames,
          [formName]: s.formNames[formName]?.filter((h) => h !== handle) || [],
        },
      }));
    };
  },

  validate: async (formName) => {
    const subforms = get().formNames[formName] || [];
    const results = await Promise.all(subforms.map((h) => h.validate()));
    return results.every(Boolean);
  },

  validateAndSave: async (formName, saveFn) => {
    const subforms = get().formNames[formName] || [];
    console.log(`[FormRegistry] validateAndSave "${formName}": ${subforms.length} subform(s) registered`);

    // Validate all subforms
    const results = await Promise.all(subforms.map((h) => h.validate()));
    const allValid = results.every(Boolean);

    if (!allValid) {
      const failedIndices = results.map((v, i) => (!v ? i : -1)).filter((i) => i >= 0);
      console.warn(`[FormRegistry] Validation failed for "${formName}": subform(s) at index ${failedIndices.join(", ")} returned false`);
      return { valid: false };
    }

    // Collect data from all subforms
    const allData: FormData[] = [];
    for (const form of subforms) {
      const data = form.getData?.();
      if (data) {
        allData.push(data);
      }
    }

    // Nothing to save but validation passed
    if (allData.length === 0) {
      return { valid: true };
    }

    // Merge all form data
    const mergedData = allData.reduce((merged, data) => ({ ...merged, ...data }), {});

    // Save
    try {
      await saveFn(mergedData);
      return { valid: true };
    } catch (error) {
      console.error(`[FormRegistry] Save failed for "${formName}":`, error);
      return { valid: false, error: error as Error };
    }
  },
}));

export const selectRegister = (s: FormRegistryStore) => s.register;
export const selectValidate = (s: FormRegistryStore) => s.validate;
export const selectValidateAndSave = (s: FormRegistryStore) => s.validateAndSave;
