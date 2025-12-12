import { create } from "zustand";

type FormHandle = {
  validate: () => Promise<boolean>;
};

type FormRegistryState = {
  parents: Record<string, FormHandle[]>;
  focusedForm: string | null;
};

type FormRegistryActions = {
  register: (parent: string, handle: FormHandle) => () => void;
  setFormFocused: (id: string | null) => void;
  validateParent: (parentId: string) => Promise<boolean>;
  validateAll: () => Promise<boolean>;
};

type FormRegistryStore = FormRegistryState & FormRegistryActions;

export const useFormRegistry = create<FormRegistryStore>((set, get) => ({
  parents: {},
  focusedForm: null,

  register: (parent, handle) => {
    set((s) => ({
      parents: {
        ...s.parents,
        [parent]: [...(s.parents[parent] || []), handle],
      },
    }));

    return () => {
      set((s) => ({
        parents: {
          ...s.parents,
          [parent]: s.parents[parent]?.filter((h) => h !== handle) || [],
        },
      }));
    };
  },

  setFormFocused: (id) => set({ focusedForm: id }),

  validateParent: async (parentId) => {
    const handles = get().parents[parentId] || [];
    const results = await Promise.all(handles.map((h) => h.validate()));
    return results.every(Boolean);
  },

  validateAll: async () => {
    const allHandles = Object.values(get().parents).flat();
    const results = await Promise.all(allHandles.map((h) => h.validate()));
    return results.every(Boolean);
  },
}));

export const selectFocusedForm = (s: FormRegistryStore) => s.focusedForm;
export const selectValidateParent = (s: FormRegistryStore) => s.validateParent;
export const selectValidateAll = (s: FormRegistryStore) => s.validateAll;
export const selectRegister = (s: FormRegistryStore) => s.register;
export const selectSetFormFocused = (s: FormRegistryStore) => s.setFormFocused;
