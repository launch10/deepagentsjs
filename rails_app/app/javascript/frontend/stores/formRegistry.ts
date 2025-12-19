import { create } from "zustand";

type FormHandle = {
  validate: () => Promise<boolean>;
  save?: () => Promise<void>;
};

type FormRegistryState = {
  formNames: Record<string, FormHandle[]>;
};

type FormRegistryActions = {
  register: (formName: string, handle: FormHandle) => () => void;
  validate: (formName: string) => Promise<boolean>;
  save: (formName: string) => Promise<void>;
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

  save: async (formName) => {
    const subforms = get().formNames[formName] || [];
    const savePromises = subforms.map((h) => h.save?.() ?? Promise.resolve());
    await Promise.all(savePromises);
  },
}));

export const selectValidate = (s: FormRegistryStore) => s.validate;
export const selectRegister = (s: FormRegistryStore) => s.register;
export const selectSave = (s: FormRegistryStore) => s.save;
