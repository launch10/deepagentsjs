import { useEffect } from "react";
import type { FieldErrors, UseFormReturn } from "react-hook-form";
import { useFormRegistry, selectRegister } from "@stores/formRegistry";

function normalizeArrayErrors(methods: UseFormReturn<any>) {
  const errors = methods.formState.errors;

  Object.keys(errors).forEach((key) => {
    const error = errors[key] as FieldErrors & { root?: { type?: string; message?: string } };
    if (error && "root" in error && error.root?.message && !("message" in error)) {
      methods.clearErrors(key);
      methods.setError(key, {
        type: error.root.type || "custom",
        message: error.root.message,
      });
    }
  });
}

export function useFormRegistration(
  formName: string,
  methods: UseFormReturn<any>,
  save?: () => Promise<void>
) {
  const register = useFormRegistry(selectRegister);

  useEffect(() => {
    const unregister = register(formName, {
      validate: async () => {
        const isValid = await methods.trigger();
        if (!isValid) {
          normalizeArrayErrors(methods);
        }
        return isValid;
      },
      save,
    });
    return unregister;
  }, [formName, methods, register, save]);
}
