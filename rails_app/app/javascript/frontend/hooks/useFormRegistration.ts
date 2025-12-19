import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFormRegistry, selectRegister } from "@stores/formRegistry";

export function useFormRegistration(
  formName: string,
  methods: UseFormReturn<any>,
  save?: () => Promise<void>
) {
  const register = useFormRegistry(selectRegister);

  useEffect(() => {
    const unregister = register(formName, {
      validate: () => methods.trigger(),
      save,
    });
    return unregister;
  }, [formName, methods, register, save]);
}
